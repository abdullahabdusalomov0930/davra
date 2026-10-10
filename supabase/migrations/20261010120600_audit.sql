-- Audit log triggers: every moderation action made by a signed-in staff member is recorded.
--
-- Moderation runs through the staff member's own session (RLS), never through the secret key, so
-- auth.uid() always identifies the actor. Changes without a signed-in user (migrations, scheduled
-- jobs, import scripts) are not moderation actions and are not logged.

create function private.log_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  kind text;
  before_row jsonb;
  after_row jsonb;
begin
  if actor is null then
    return null;
  end if;

  case tg_table_name
    when 'resources' then
      -- Authors' own edits (e.g. a new URL sending the card back to the queue) are not moderation.
      if not private.is_staff() then
        return null;
      end if;
      if new.status is distinct from old.status then
        insert into public.audit_log (actor_id, action, target_type, target_id, details)
        values (actor, 'resource.status', 'resource', new.id::text,
          jsonb_build_object('from', old.status, 'to', new.status));
      end if;
      if new.link_status is distinct from old.link_status then
        insert into public.audit_log (actor_id, action, target_type, target_id, details)
        values (actor, 'resource.link_status', 'resource', new.id::text,
          jsonb_build_object('from', old.link_status, 'to', new.link_status));
      end if;

    when 'comments' then
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values (actor, 'comment.status', 'comment', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status, 'resource_id', new.resource_id));

    when 'reports' then
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values (actor, 'report.status', 'report', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status,
          'target_type', new.target_type, 'target_id', new.target_id));

    when 'profiles' then
      if new.is_banned is distinct from old.is_banned then
        insert into public.audit_log (actor_id, action, target_type, target_id, details)
        values (actor, case when new.is_banned then 'user.ban' else 'user.unban' end, 'user', new.id::text,
          jsonb_build_object('username', new.username));
      end if;
      if new.role is distinct from old.role then
        insert into public.audit_log (actor_id, action, target_type, target_id, details)
        values (actor, 'user.role', 'user', new.id::text,
          jsonb_build_object('username', new.username, 'from', old.role, 'to', new.role));
      end if;

    when 'topics', 'blocked_domains' then
      if tg_op in ('UPDATE', 'DELETE') then
        before_row := to_jsonb(old);
      end if;
      if tg_op in ('INSERT', 'UPDATE') then
        after_row := to_jsonb(new);
      end if;
      kind := case tg_table_name when 'topics' then 'topic' else 'blocked_domain' end;
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values (actor, kind || '.' || lower(tg_op), kind,
        coalesce(after_row, before_row) ->> case kind when 'topic' then 'id' else 'domain' end,
        jsonb_build_object('before', before_row, 'after', after_row));
  end case;

  return null;
end;
$$;

create trigger log_moderation
  after update on public.resources
  for each row
  when (old.status is distinct from new.status or old.link_status is distinct from new.link_status)
  execute function private.log_moderation();

create trigger log_moderation
  after update on public.comments
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_moderation();

create trigger log_moderation
  after update on public.reports
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_moderation();

create trigger log_moderation
  after update on public.profiles
  for each row
  when (old.is_banned is distinct from new.is_banned or old.role is distinct from new.role)
  execute function private.log_moderation();

create trigger log_moderation
  after insert or update or delete on public.topics
  for each row execute function private.log_moderation();

create trigger log_moderation
  after insert or update or delete on public.blocked_domains
  for each row execute function private.log_moderation();

revoke execute on all functions in schema private from public;
