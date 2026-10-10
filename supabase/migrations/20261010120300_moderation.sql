-- Moderation tables: blocked domains, reports and the audit log.
-- The moderation actions themselves are logged by triggers (see the audit migration).

-- ---------------------------------------------------------------------------
-- Blocked domains (URL shorteners and spam sites). A rule also blocks every subdomain.
-- ---------------------------------------------------------------------------

create table public.blocked_domains (
  domain text primary key,
  reason text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint blocked_domains_domain_format check (
    domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' and char_length(domain) <= 253
  ),
  constraint blocked_domains_reason_length check (char_length(reason) <= 200)
);

-- SECURITY DEFINER: authors cannot read the blocklist, but their inserts must be checked against it.
create function private.is_blocked_domain(host text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocked_domains b
    where host = b.domain or right(host, char_length(b.domain) + 1) = '.' || b.domain
  );
$$;

grant execute on function private.is_blocked_domain(text) to authenticated, service_role;

revoke all on table public.blocked_domains from anon, authenticated;
grant select, delete on table public.blocked_domains to authenticated;
grant insert (domain, reason), update (reason) on table public.blocked_domains to authenticated;

alter table public.blocked_domains enable row level security;

create policy "Staff can read blocked domains"
  on public.blocked_domains for select
  to authenticated
  using ((select private.is_staff()));

create policy "Admins can add blocked domains"
  on public.blocked_domains for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "Admins can update blocked domains"
  on public.blocked_domains for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Admins can remove blocked domains"
  on public.blocked_domains for delete
  to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  -- resources.id for 'resource' and 'broken_link', comments.id for 'comment', profiles.id for 'user'.
  target_id uuid not null,
  -- The user responsible for the reported content, resolved on insert. Kept after the content is
  -- deleted so confirmed reports keep counting against its author (see private.is_trusted_author).
  target_owner_id uuid references public.profiles (id) on delete set null,
  reason public.report_reason,
  details text,
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),

  -- A broken-link report needs no reason; every other report does.
  constraint reports_reason_required check ((target_type = 'broken_link') = (reason is null)),
  constraint reports_details_length check (char_length(details) <= 500)
);

-- One open report per user and target (this also gives "one broken-link report per user per resource").
create unique index reports_one_open_per_reporter on public.reports (reporter_id, target_type, target_id)
  where status = 'open';
create index reports_queue_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);
create index reports_target_owner_idx on public.reports (target_owner_id) where status = 'resolved';

-- SECURITY INVOKER on purpose: reporters can only report targets they are allowed to see.
create function private.prepare_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.target_owner_id := case new.target_type
    when 'resource' then (select author_id from public.resources where id = new.target_id)
    when 'broken_link' then (select author_id from public.resources where id = new.target_id and status = 'published')
    when 'comment' then (select author_id from public.comments where id = new.target_id)
    when 'user' then (select id from public.profiles where id = new.target_id)
  end;

  if new.target_owner_id is null then
    raise exception 'Report target not found' using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger prepare_report
  before insert on public.reports
  for each row execute function private.prepare_report();

-- Handling a report records who handled it and when; reopening clears both.
create function private.track_report_handling()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'open' then
      new.handled_by := null;
      new.handled_at := null;
    else
      new.handled_by := coalesce((select auth.uid()), new.handled_by);
      new.handled_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger track_handling
  before update on public.reports
  for each row execute function private.track_report_handling();

revoke all on table public.reports from anon, authenticated;
grant select on table public.reports to authenticated;
grant insert (target_type, target_id, reason, details), update (status) on table public.reports to authenticated;

alter table public.reports enable row level security;

create policy "Reporters see their reports; staff see all"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_staff()));

create policy "Active users can report"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()) and (select private.is_active_user()));

create policy "Staff can handle reports"
  on public.reports for update
  to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Audit log: append-only record of moderation actions. Written only by SECURITY DEFINER triggers.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  -- e.g. 'resource.status', 'user.ban', 'topic.insert'
  action text not null,
  target_type text not null,
  -- Text, because blocked domains are keyed by name rather than by uuid.
  target_id text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;

alter table public.audit_log enable row level security;

create policy "Staff can read the audit log"
  on public.audit_log for select
  to authenticated
  using ((select private.is_staff()));

revoke execute on all functions in schema private from public;
