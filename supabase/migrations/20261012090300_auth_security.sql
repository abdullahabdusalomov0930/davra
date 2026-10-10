-- Application security (security addendum 5.5, 5.9, 5.10; DECISIONS.md D74–D76): a general rate limit
-- by hashed IP or e-mail for actions without a database row of their own (sign-in, sign-up, password
-- reset, search, link submission), a log of suspicious sign-in activity, and IP hashes kept 30 days.

-- ---------------------------------------------------------------------------
-- 1. Rate limits by key (sliding window)
-- ---------------------------------------------------------------------------

create table private.rate_limit_hits (
  bucket text not null,
  -- Keyed hash of an IP address, an e-mail address or a user id; never the value itself.
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_lookup_idx on private.rate_limit_hits (bucket, key_hash, created_at desc);

revoke all on table private.rate_limit_hits from public, anon, authenticated;

-- Records one hit and says whether it is within the limit. Called by the app server with the secret
-- key (src/server/rate-limit.ts).
create function public.hit_rate_limit(bucket text, key_hash text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if max_hits < 1 or window_seconds < 1 or window_seconds > 7 * 24 * 3600 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(bucket || ':' || key_hash, 0));
  if (
    select count(*) from private.rate_limit_hits h
    where h.bucket = hit_rate_limit.bucket and h.key_hash = hit_rate_limit.key_hash
      and h.created_at > now() - make_interval(secs => window_seconds)
  ) >= max_hits then
    return false;
  end if;
  insert into private.rate_limit_hits (bucket, key_hash) values (hit_rate_limit.bucket, hit_rate_limit.key_hash);
  return true;
end;
$$;

revoke execute on function public.hit_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, text, integer, integer) to service_role;

select cron.schedule(
  'prune-rate-limit-hits',
  '35 22 * * *',
  $$delete from private.rate_limit_hits where created_at < now() - interval '8 days'$$
);

-- ---------------------------------------------------------------------------
-- 2. Auth events: failed sign-ins, sign-ups, resets, limits hit (admins only, 30 days)
-- ---------------------------------------------------------------------------

create table public.auth_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  -- No foreign key: an event may concern an address without an account.
  user_id uuid,
  email_hash text,
  ip_hash text,
  created_at timestamptz not null default now(),

  constraint auth_events_kind check (kind in (
    'sign_in', 'sign_in_failed', 'sign_up', 'password_reset_requested', 'password_changed',
    'rate_limited', 'captcha_failed', 'account_deleted'
  ))
);

create index auth_events_created_idx on public.auth_events (created_at desc);
create index auth_events_ip_idx on public.auth_events (ip_hash, created_at desc);
create index auth_events_email_idx on public.auth_events (email_hash, created_at desc);

revoke all on table public.auth_events from anon, authenticated;
grant select on table public.auth_events to authenticated;

alter table public.auth_events enable row level security;

create policy "Admins read auth events"
  on public.auth_events for select
  to authenticated
  using ((select private.is_admin()));

-- Addresses that look like attacks: many failed sign-ins, or many new accounts, in the last day.
create function public.suspicious_auth_activity()
returns table (ip_hash text, failed_sign_ins bigint, sign_ups bigint, last_seen timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.ip_hash,
    count(*) filter (where e.kind = 'sign_in_failed'),
    count(*) filter (where e.kind = 'sign_up'),
    max(e.created_at)
  from public.auth_events e
  where private.is_admin() and e.ip_hash is not null and e.created_at > now() - interval '1 day'
  group by e.ip_hash
  having count(*) filter (where e.kind = 'sign_in_failed') >= 10 or count(*) filter (where e.kind = 'sign_up') >= 3
  order by max(e.created_at) desc
  limit 50;
$$;

revoke execute on function public.suspicious_auth_activity() from public, anon;
grant execute on function public.suspicious_auth_activity() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. IP hashes are kept 30 days at most
-- ---------------------------------------------------------------------------

alter table public.removal_requests alter column ip_hash drop not null;

select cron.schedule(
  'forget-ip-hashes',
  '40 22 * * *',
  $$
    update public.removal_requests set ip_hash = null where ip_hash is not null and created_at < now() - interval '30 days';
    delete from public.auth_events where created_at < now() - interval '30 days';
  $$
);

revoke execute on all functions in schema private from public;
