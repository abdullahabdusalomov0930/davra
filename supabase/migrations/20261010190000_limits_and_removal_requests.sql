-- Rate limits for user actions and the public removal-request queue (DECISIONS.md D52–D54).

-- ---------------------------------------------------------------------------
-- Rate limits (section 6.3 of the brief)
--
--   new resources   3 per day (10 for trusted authors)
--   comments        30 per day
--   likes + saves   100 per hour, together
--   reports         20 per day
--
-- Every limited insert made by a signed-in user through the Data API records an event; a BEFORE INSERT
-- trigger counts the user's events in the window and refuses the insert past the limit. Events are
-- counted rather than rows, so deleting and re-creating (like, unlike, like…) does not reset a limit.
-- An insert that fails for any other reason rolls its event back with it. Staff and trusted server code
-- (service role, scripts, jobs) are not limited.
-- ---------------------------------------------------------------------------

create table private.rate_events (
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index rate_events_lookup_idx on private.rate_events (user_id, action, created_at desc);

revoke all on table private.rate_events from public, anon, authenticated;

-- Takes one slot for the signed-in user, or returns false when the window is full. SECURITY DEFINER:
-- users cannot read or write the events table themselves.
create function private.take_rate_slot(limited_action text, max_events integer, window_length interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  -- One request at a time per user and action, so parallel requests cannot share the last slot.
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || limited_action, 0));

  if (
    select count(*) from private.rate_events e
    where e.user_id = actor and e.action = limited_action and e.created_at > now() - window_length
  ) >= max_events then
    return false;
  end if;

  insert into private.rate_events (user_id, action) values (actor, limited_action);
  return true;
end;
$$;

grant execute on function private.take_rate_slot(text, integer, interval) to authenticated;

-- Trigger arguments: action, limit, window[, limit for trusted authors].
-- SECURITY INVOKER, so current_user tells Data API callers apart from trusted server code.
create function private.enforce_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  limited_action text := tg_argv[0];
  max_events integer := tg_argv[1]::integer;
  window_length interval := tg_argv[2]::interval;
begin
  if current_user not in ('anon', 'authenticated') or (select auth.uid()) is null or private.is_staff() then
    return new;
  end if;

  if tg_nargs > 3 and private.is_trusted_author((select auth.uid())) then
    max_events := tg_argv[3]::integer;
  end if;

  if not private.take_rate_slot(limited_action, max_events, window_length) then
    raise exception 'rate_limited' using errcode = 'P0001', detail = limited_action,
      hint = 'Too many actions in a short time; try again later.';
  end if;
  return new;
end;
$$;

create trigger rate_limit
  before insert on public.resources
  for each row execute function private.enforce_rate_limit('resource', '3', '1 day', '10');

create trigger rate_limit
  before insert on public.comments
  for each row execute function private.enforce_rate_limit('comment', '30', '1 day');

create trigger rate_limit
  before insert on public.resource_likes
  for each row execute function private.enforce_rate_limit('like_or_save', '100', '1 hour');

create trigger rate_limit
  before insert on public.resource_saves
  for each row execute function private.enforce_rate_limit('like_or_save', '100', '1 hour');

create trigger rate_limit
  before insert on public.reports
  for each row execute function private.enforce_rate_limit('report', '20', '1 day');

-- Events older than the longest window are useless; prune them daily (03:30 in Tashkent).
select cron.schedule(
  'prune-rate-events',
  '30 22 * * *',
  $$delete from private.rate_events where created_at < now() - interval '2 days'$$
);

-- ---------------------------------------------------------------------------
-- Removal requests (/removal-request): copyright holders and others ask for a card to be taken down,
-- without an account. The app's server inserts them with the secret key after validating the form and
-- applying a per-IP limit, so the Data API grants no insert at all. Staff read and handle them.
-- ---------------------------------------------------------------------------

create table public.removal_requests (
  id uuid primary key default gen_random_uuid(),
  -- The Davra page or the external link the request is about, as the sender wrote it.
  resource_url text not null,
  requester_name text not null,
  requester_email text not null,
  details text not null,
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  -- Keyed hash of the sender's IP address for the per-IP limit; the address itself is never stored.
  ip_hash text not null,
  created_at timestamptz not null default now(),

  constraint removal_requests_url_length check (char_length(resource_url) between 1 and 2048),
  constraint removal_requests_name_length check (char_length(btrim(requester_name)) between 2 and 100),
  constraint removal_requests_email_format check (
    char_length(requester_email) <= 254 and requester_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint removal_requests_details_length check (char_length(btrim(details)) between 20 and 2000)
);

create index removal_requests_queue_idx on public.removal_requests (status, created_at);
create index removal_requests_ip_idx on public.removal_requests (ip_hash, created_at desc);

create trigger track_handling
  before update on public.removal_requests
  for each row execute function private.track_report_handling();

revoke all on table public.removal_requests from anon, authenticated;
grant select, update (status) on table public.removal_requests to authenticated;

alter table public.removal_requests enable row level security;

create policy "Staff can read removal requests"
  on public.removal_requests for select
  to authenticated
  using ((select private.is_staff()));

create policy "Staff can handle removal requests"
  on public.removal_requests for update
  to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Audit log: handling a removal request is a moderation action too. Same function as in
-- 20261010120600_audit.sql plus the removal_requests branch.
-- ---------------------------------------------------------------------------

create or replace function private.log_moderation()
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

    when 'removal_requests' then
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values (actor, 'removal_request.status', 'removal_request', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status, 'resource_url', new.resource_url));

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
  after update on public.removal_requests
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_moderation();

revoke execute on all functions in schema private from public;
