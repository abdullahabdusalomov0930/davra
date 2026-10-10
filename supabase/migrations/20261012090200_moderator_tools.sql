-- Moderator tools (security addendum layer 4 and section 4; DECISIONS.md D71–D73): one function per
-- action, each with a required reason; deletions and permanent bans by moderators need an admin's
-- confirmation; categories for blocked domains; an admin-editable word list; link reputation.
--
-- The functions run as the calling staff member (SECURITY INVOKER), so RLS, the guard triggers and
-- the audit log apply exactly as for a direct update. They set the reason for the audit log and the
-- notification (set_config(…, true): this transaction only).

-- ---------------------------------------------------------------------------
-- 1. Moderation context
-- ---------------------------------------------------------------------------

create function private.set_moderation_context(reason text, rule text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(reason, ''))) < 3 or char_length(reason) > 500 then
    raise exception 'reason_required' using errcode = 'P0001', hint = 'Give a reason of 3–500 characters.';
  end if;
  perform set_config('davra.reason', btrim(reason), true);
  perform set_config('davra.rule', coalesce(rule, ''), true);
end;
$$;

create function private.require_admin()
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admin_required' using errcode = '42501', hint = 'Only an admin can do this.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Content
-- ---------------------------------------------------------------------------

create function public.moderate_resource(resource_id uuid, new_status public.resource_status, reason text, rule text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.set_moderation_context(reason, rule);
  update public.resources set status = new_status where id = resource_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.moderate_comment(comment_id uuid, new_status public.comment_status, reason text, rule text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.set_moderation_context(reason, rule);
  update public.comments set status = new_status where id = comment_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Admins delete for good; moderators ask an admin (request_action). Content under a severe report
-- can only be deleted once the incident is marked preserved.
create policy "Admins can delete resources"
  on public.resources for delete
  to authenticated
  using ((select private.is_admin()));

create policy "Admins can delete comments"
  on public.comments for delete
  to authenticated
  using ((select private.is_admin()));

create function public.delete_content(target_type text, target_id uuid, reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform private.set_moderation_context(reason);
  if private.has_open_severe_incident(target_type, target_id) then
    raise exception 'evidence_not_preserved' using errcode = 'P0001',
      hint = 'Mark the severe incident as preserved before deleting.';
  end if;
  if target_type = 'resource' then
    delete from public.resources where id = target_id;
  elsif target_type = 'comment' then
    delete from public.comments where id = target_id;
  else
    raise exception 'invalid_target' using errcode = '22023';
  end if;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function private.has_open_severe_incident(incident_target_type text, incident_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.severe_incidents s
    where s.target_type = incident_target_type and s.target_id = incident_target_id and s.status = 'open'
  );
$$;

-- Deleting someone else's content is logged with the reason and what was deleted.
create function private.log_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  -- Comments deleted along with their resource are covered by the resource's entry.
  if actor is null or old.author_id = actor or pg_trigger_depth() > 1 or not private.is_staff() then
    return null;
  end if;
  perform private.audit(actor, case tg_table_name when 'resources' then 'resource.delete' else 'comment.delete' end,
    case tg_table_name when 'resources' then 'resource' else 'comment' end, old.id::text,
    case tg_table_name
      when 'resources' then jsonb_build_object('title', to_jsonb(old) ->> 'title', 'url', to_jsonb(old) ->> 'url',
        'author_id', old.author_id)
      else jsonb_build_object('body', left(to_jsonb(old) ->> 'body', 200), 'author_id', old.author_id)
    end,
    nullif(current_setting('davra.reason', true), ''), true);
  return null;
end;
$$;

create trigger log_deletion
  after delete on public.resources
  for each row execute function private.log_deletion();

create trigger log_deletion
  after delete on public.comments
  for each row execute function private.log_deletion();

-- ---------------------------------------------------------------------------
-- 3. Users
-- ---------------------------------------------------------------------------

-- ban_days: 1, 7 or 30 for a temporary ban, null for a permanent one (admins), 0 to lift the ban.
create function public.set_user_ban(user_id uuid, ban_days integer, reason text, rule text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.set_moderation_context(reason, rule);
  if ban_days is not null and ban_days not in (0, 1, 7, 30) then
    raise exception 'invalid_ban_length' using errcode = '22023';
  end if;
  update public.profiles
  set is_banned = ban_days is distinct from 0,
      banned_until = case when ban_days > 0 then now() + make_interval(days => ban_days) end,
      ban_reason = case when ban_days is distinct from 0 then btrim(reason) end
  where id = user_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.warn_user(user_id uuid, reason text, rule text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.set_moderation_context(reason, rule);
  insert into public.notifications (user_id, kind, target_type, target_id, rule, message)
  values (user_id, 'warning', 'user', user_id, nullif(rule, ''), btrim(reason));
end;
$$;

create function public.set_user_role(user_id uuid, new_role public.user_role, reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.set_moderation_context(reason);
  update public.profiles set role = new_role where id = user_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- level null gives the user back to the automatic rules.
create function public.set_trust_level(user_id uuid, level integer, reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.set_moderation_context(reason);
  if level is null then
    update public.profiles set trust_level_manual = false where id = user_id;
  else
    update public.profiles set trust_level = level, trust_level_manual = true where id = user_id;
  end if;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reports, appeals, removal requests
-- ---------------------------------------------------------------------------

-- Decides every open report about one item: "take_down" hides it and resolves the reports,
-- "resolve" only resolves them (the item was dealt with otherwise), "dismiss" closes them and gives
-- back an item the reports had hidden automatically. Dismissing a severe report is for admins.
create function public.handle_reports(target_type public.report_target, target_id uuid, decision text, reason text,
  rule text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  severe boolean;
begin
  perform private.set_moderation_context(reason, rule);
  if decision not in ('take_down', 'resolve', 'dismiss') or target_type = 'broken_link' then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;

  select bool_or(r.reason = 'severe') into severe
  from public.reports r
  where r.target_type = handle_reports.target_type and r.target_id = handle_reports.target_id and r.status = 'open';
  if severe is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if severe and decision = 'dismiss' then
    perform private.require_admin();
  end if;

  if decision = 'take_down' then
    if target_type = 'resource' then
      update public.resources set status = 'hidden' where id = target_id and status <> 'hidden';
    elsif target_type = 'comment' then
      update public.comments set status = 'hidden' where id = target_id and status <> 'hidden';
    else
      raise exception 'invalid_decision' using errcode = '22023', hint = 'Ban or warn the user instead.';
    end if;
  elsif decision = 'dismiss' then
    if target_type = 'resource' then
      update public.resources set status = 'published'
      where id = target_id and status = 'hidden' and moderation_state in ('auto_hidden', 'severe');
    elsif target_type = 'comment' then
      update public.comments set status = 'published'
      where id = target_id and status = 'hidden' and moderation_state in ('auto_hidden', 'severe');
    end if;
  end if;

  update public.reports r
  set status = case when decision = 'dismiss' then 'dismissed'::public.report_status else 'resolved'::public.report_status end
  where r.target_type = handle_reports.target_type and r.target_id = handle_reports.target_id and r.status = 'open';
end;
$$;

-- Accepting an appeal gives the item back (or lifts the ban).
create function public.handle_appeal(appeal_id uuid, accept boolean, response text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  appeal public.appeals;
begin
  perform private.set_moderation_context(response);
  update public.appeals
  set status = case when accept then 'accepted' else 'rejected' end, response = btrim(handle_appeal.response)
  where id = appeal_id and status = 'open'
  returning * into appeal;
  if appeal.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if accept then
    if appeal.target_type = 'resource' then
      update public.resources set status = 'published' where id = appeal.target_id and status in ('hidden', 'rejected');
    elsif appeal.target_type = 'comment' then
      update public.comments set status = 'published' where id = appeal.target_id and status = 'hidden';
    else
      perform public.set_user_ban(appeal.user_id, 0, response);
    end if;
  end if;
end;
$$;

create function public.handle_removal_request(request_id uuid, new_status public.report_status, reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.set_moderation_context(reason);
  update public.removal_requests set status = new_status where id = request_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Two-step severe actions: moderators ask, admins confirm
-- ---------------------------------------------------------------------------

create table public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  target_id uuid not null,
  reason text not null,
  requested_by uuid default auth.uid() references public.profiles (id) on delete set null,
  status text not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),

  constraint pending_actions_kind check (kind in ('permanent_ban', 'delete_resource', 'delete_comment')),
  constraint pending_actions_status check (status in ('pending', 'approved', 'rejected')),
  constraint pending_actions_reason_length check (char_length(btrim(reason)) between 3 and 500)
);

create unique index pending_actions_one_open on public.pending_actions (kind, target_id) where status = 'pending';

revoke all on table public.pending_actions from anon, authenticated;
grant select, insert (kind, target_id, reason) on table public.pending_actions to authenticated;

alter table public.pending_actions enable row level security;

create policy "Staff see requested actions"
  on public.pending_actions for select
  to authenticated
  using ((select private.is_staff()));

create policy "Staff request actions"
  on public.pending_actions for insert
  to authenticated
  with check (requested_by = (select auth.uid()) and (select private.is_staff()));

create function public.request_action(kind text, target_id uuid, reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.set_moderation_context(reason);
  insert into public.pending_actions (kind, target_id, reason) values (kind, target_id, btrim(reason));
  perform private.audit((select auth.uid()), 'action.request', 'pending_action', target_id::text,
    jsonb_build_object('kind', kind), reason, true);
end;
$$;

-- Decided by an admin with SECURITY DEFINER for the status change only; the action itself runs
-- through the admin's own rights.
create function private.decide_pending(action_id uuid, approve boolean)
returns public.pending_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  decided public.pending_actions;
begin
  update public.pending_actions
  set status = case when approve then 'approved' else 'rejected' end, decided_by = (select auth.uid()), decided_at = now()
  where id = action_id and status = 'pending'
  returning * into decided;
  return decided;
end;
$$;

create function public.decide_pending_action(action_id uuid, approve boolean, note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  decided public.pending_actions;
  reason text;
begin
  perform private.require_admin();
  decided := private.decide_pending(action_id, approve);
  if decided.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  reason := decided.reason || coalesce(' — ' || nullif(btrim(note), ''), '');
  perform private.audit((select auth.uid()), case when approve then 'action.approve' else 'action.reject' end,
    'pending_action', decided.target_id::text, jsonb_build_object('kind', decided.kind, 'requested_by', decided.requested_by),
    reason, true);
  if approve then
    case decided.kind
      when 'permanent_ban' then perform public.set_user_ban(decided.target_id, null, reason);
      when 'delete_resource' then perform public.delete_content('resource', decided.target_id, reason);
      when 'delete_comment' then perform public.delete_content('comment', decided.target_id, reason);
    end case;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Blocklists: domain categories, and words admins add to the built-in lists
-- ---------------------------------------------------------------------------

alter table public.blocked_domains rename column created_by to added_by;
alter table public.blocked_domains
  add column category text not null default 'other',
  add constraint blocked_domains_category check (
    category in ('shortener', 'adult', 'gambling', 'piracy', 'scam', 'malware', 'spam', 'other')
  );
grant insert (category), update (category) on table public.blocked_domains to authenticated;

create table public.blocked_terms (
  -- Same syntax as the word lists in src/server/safety/data/words: "word", "stem*", "two words".
  term text primary key,
  category text not null,
  added_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint blocked_terms_category check (
    category in ('profanity', 'hate', 'sexual', 'drugs_weapons', 'scam', 'gambling')
  ),
  constraint blocked_terms_format check (char_length(term) between 2 and 80 and term = lower(btrim(term)))
);

revoke all on table public.blocked_terms from anon, authenticated;
grant select, insert (term, category), delete on table public.blocked_terms to authenticated;

alter table public.blocked_terms enable row level security;

create policy "Staff read blocked terms"
  on public.blocked_terms for select
  to authenticated
  using ((select private.is_staff()));

create policy "Admins add blocked terms"
  on public.blocked_terms for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "Admins remove blocked terms"
  on public.blocked_terms for delete
  to authenticated
  using ((select private.is_admin()));

create trigger log_moderation
  after insert or delete on public.blocked_terms
  for each row execute function private.log_moderation();

-- ---------------------------------------------------------------------------
-- 7. Link safety: first card for a domain, reputation re-checks
-- ---------------------------------------------------------------------------

-- A link to a domain Davra had not seen before, shared by a member below trust level 2, may open the
-- "you are leaving Davra" page first (app_settings.interstitial_mode) until the reputation check
-- calls it safe. Cards from trusted members and from trusted server code (imports) are not marked.
alter table public.resources add column unvetted_domain boolean not null default false;

-- SECURITY DEFINER: authors cannot see every card on a domain (pending, hidden).
create function private.domain_seen(host text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.resources r where r.domain = host);
$$;

-- SECURITY INVOKER, so is_api_write() tells members apart from trusted server code.
create function private.mark_unvetted_domain()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.unvetted_domain := private.is_api_write()
    and private.trust_level_of(new.author_id) < 2
    and not private.domain_seen(private.url_host(new.url));
  return new;
end;
$$;

create trigger mark_unvetted_domain
  before insert on public.resources
  for each row execute function private.mark_unvetted_domain();

-- The weekly link check asks the reputation service again; a newly flagged link is hidden and goes
-- to the moderators. Called by the link checker with the secret key only.
create function public.record_reputation(resource_id uuid, reputation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if reputation not in ('unknown', 'safe', 'flagged') then
    raise exception 'invalid_reputation' using errcode = '22023';
  end if;
  update public.resources set reputation_status = reputation where id = resource_id;
  if reputation = 'flagged' then
    perform set_config('davra.reason', 'Link flagged by the reputation check', true);
    update public.resources set status = 'hidden', moderation_state = 'reputation_flagged'
    where id = resource_id and status = 'published';
    if found then
      insert into public.audit_log (actor_id, action, target_type, target_id, details, reason)
      values (null, 'resource.reputation_hide', 'resource', resource_id::text, '{}', 'Link flagged by the reputation check');
    end if;
  end if;
end;
$$;

revoke execute on function public.record_reputation(uuid, text) from public, anon, authenticated;
grant execute on function public.record_reputation(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Author history for the queues (staff only)
-- ---------------------------------------------------------------------------

create function public.author_records(user_ids uuid[])
returns table (user_id uuid, published bigint, hidden bigint, rejected bigint, confirmed_reports bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
    (select count(*) from public.resources r where r.author_id = u.id and r.status = 'published'),
    (select count(*) from public.resources r where r.author_id = u.id and r.status = 'hidden'),
    (select count(*) from public.resources r where r.author_id = u.id and r.status = 'rejected'),
    (select count(*) from public.reports rep
      where rep.target_owner_id = u.id and rep.status = 'resolved' and rep.target_type <> 'broken_link')
  from unnest(user_ids) as u (id)
  where private.is_staff();
$$;

revoke execute on function public.author_records(uuid[]) from public, anon;
grant execute on function public.author_records(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges for the moderation functions: signed-in users may call them, RLS and the guards decide.
-- ---------------------------------------------------------------------------

revoke execute on function public.moderate_resource(uuid, public.resource_status, text, text) from public, anon;
revoke execute on function public.moderate_comment(uuid, public.comment_status, text, text) from public, anon;
revoke execute on function public.delete_content(text, uuid, text) from public, anon;
revoke execute on function public.set_user_ban(uuid, integer, text, text) from public, anon;
revoke execute on function public.warn_user(uuid, text, text) from public, anon;
revoke execute on function public.set_user_role(uuid, public.user_role, text) from public, anon;
revoke execute on function public.set_trust_level(uuid, integer, text) from public, anon;
revoke execute on function public.handle_reports(public.report_target, uuid, text, text, text) from public, anon;
revoke execute on function public.handle_appeal(uuid, boolean, text) from public, anon;
revoke execute on function public.handle_removal_request(uuid, public.report_status, text) from public, anon;
revoke execute on function public.request_action(text, uuid, text) from public, anon;
revoke execute on function public.decide_pending_action(uuid, boolean, text) from public, anon;

revoke execute on all functions in schema private from public;
grant execute on function private.set_moderation_context(text, text) to authenticated;
grant execute on function private.require_admin() to authenticated;
grant execute on function private.has_open_severe_incident(text, uuid) to authenticated;
grant execute on function private.decide_pending(uuid, boolean) to authenticated;
grant execute on function private.audit(uuid, text, text, text, jsonb, text, boolean) to authenticated;
grant execute on function private.domain_seen(text) to authenticated, service_role;
