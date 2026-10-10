-- Trust levels, bans with an end date, weighted reports with auto-hide, severe incidents, in-app
-- notifications and appeals (security addendum layers 2–3 and section 3; DECISIONS.md D67–D70).
-- Every staff moderation action now carries a reason, recorded in the audit log (D71).

-- ---------------------------------------------------------------------------
-- 1. Settings admins can change without a deploy
-- ---------------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint app_settings_key check (
    key in ('report_hide_threshold', 'report_hide_threshold_urgent', 'interstitial_mode')
  ),
  constraint app_settings_value check (
    case key
      when 'interstitial_mode' then value #>> '{}' in ('off', 'new_domains', 'unknown')
      else jsonb_typeof(value) = 'number' and (value #>> '{}')::numeric between 0.5 and 20
    end
  )
);

insert into public.app_settings (key, value) values
  -- Weighted reports from different people that hide a published resource or comment.
  ('report_hide_threshold', '3'),
  -- The same for reports of illegal content or scams/phishing.
  ('report_hide_threshold_urgent', '2'),
  -- When a link opens the "you are leaving Davra" page first: never, for domains new to Davra whose
  -- reputation is not known to be safe, or for every link not known to be safe.
  ('interstitial_mode', '"new_domains"');

revoke all on table public.app_settings from anon, authenticated;
grant select on table public.app_settings to anon, authenticated;
grant update (value) on table public.app_settings to authenticated;

alter table public.app_settings enable row level security;

create policy "Settings are public"
  on public.app_settings for select
  to anon, authenticated
  using (true);

create policy "Admins can change settings"
  on public.app_settings for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create function private.track_setting_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

create trigger track_update
  before update on public.app_settings
  for each row execute function private.track_setting_update();

create function private.setting_number(setting_key text, fallback numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value #>> '{}')::numeric from public.app_settings s where s.key = setting_key), fallback);
$$;

-- ---------------------------------------------------------------------------
-- 2. Profiles: trust level and bans
-- ---------------------------------------------------------------------------

alter table public.profiles
  -- 0 new, 1 basic, 2 trusted, 3 moderator-level. Kept up to date by the rules below unless an admin
  -- set it by hand (trust_level_manual).
  add column trust_level smallint not null default 0,
  add column trust_level_manual boolean not null default false,
  -- A temporary ban ends by itself (lift-expired-bans); null with is_banned = permanent.
  add column banned_until timestamptz,
  -- Shown to the banned user and to staff only (no column privilege; see ban_details()).
  add column ban_reason text,
  add constraint profiles_trust_level_range check (trust_level between 0 and 3),
  add constraint profiles_ban_reason_length check (char_length(ban_reason) <= 500);

revoke select on table public.profiles from anon, authenticated;
grant select (id, username, display_name, bio, university, field_of_study, role, is_banned, banned_until,
  trust_level, trust_level_manual, created_at, updated_at) on table public.profiles to anon, authenticated;
grant update (trust_level, trust_level_manual, banned_until, ban_reason) on table public.profiles to authenticated;

-- Level 0: account younger than 3 days, no published card yet, or a confirmed violation in the last
-- 14 days (a report on their content that staff resolved). Level 1: at least one published card.
-- Level 2: three or more. Staff: 3. Banned: 0.
create function private.compute_trust_level(user_id uuid, user_role public.user_role, banned boolean, joined timestamptz)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select (case
    when banned then 0
    when user_role in ('moderator', 'admin') then 3
    when joined > now() - interval '3 days' then 0
    when exists (
      select 1 from public.reports r
      where r.target_owner_id = user_id and r.status = 'resolved' and r.target_type <> 'broken_link'
        and r.handled_at > now() - interval '14 days'
    ) then 0
    else (
      select case when count(*) >= 3 then 2 when count(*) >= 1 then 1 else 0 end
      from public.resources r
      where r.author_id = user_id and r.status = 'published'
    )
  end)::smallint;
$$;

create function private.refresh_trust_level(user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
  set trust_level = private.compute_trust_level(p.id, p.role, p.is_banned, p.created_at)
  where p.id = user_id
    and not p.trust_level_manual
    and p.trust_level <> private.compute_trust_level(p.id, p.role, p.is_banned, p.created_at);
$$;

-- Who may change which profile columns through the Data API (replaces the version of
-- 20261011090100_content_safety.sql). Trusted server code is not restricted.
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_self boolean := old.id = (select auth.uid());
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if not is_self
    and (new.username, new.display_name, new.bio, new.university, new.field_of_study)
      is distinct from (old.username, old.display_name, old.bio, old.university, old.field_of_study)
  then
    raise exception 'Only the owner can edit a profile' using errcode = '42501';
  end if;

  if new.role is distinct from old.role and (is_self or not private.is_admin()) then
    raise exception 'Only an admin can change roles, and never their own' using errcode = '42501';
  end if;

  if (new.trust_level, new.trust_level_manual) is distinct from (old.trust_level, old.trust_level_manual) then
    if is_self or not private.is_admin() then
      raise exception 'Only an admin can set trust levels, and never their own' using errcode = '42501';
    end if;
    -- A level set by hand stays until an admin gives it back to the automatic rules.
    new.trust_level_manual := new.trust_level is distinct from old.trust_level or new.trust_level_manual;
  end if;

  if (new.is_banned, new.banned_until, new.ban_reason) is distinct from (old.is_banned, old.banned_until, old.ban_reason) then
    if is_self or not private.is_staff() then
      raise exception 'Only staff can ban or unban another user' using errcode = '42501';
    end if;
    if old.role <> 'user' and not private.is_admin() then
      raise exception 'Only an admin can ban or unban staff' using errcode = '42501';
    end if;
    if new.is_banned and new.banned_until is null and not private.is_admin() then
      raise exception 'Only an admin can ban permanently' using errcode = '42501';
    end if;
    if new.is_banned and new.banned_until <= now() then
      raise exception 'A ban must end in the future' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

-- Keeps the ban columns consistent and the trust level in step with role, ban and account age.
-- Runs for every writer (after guard_update, by name).
create function private.sync_profile_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.is_banned then
    new.banned_until := null;
    new.ban_reason := null;
  end if;
  if not new.trust_level_manual
    and (tg_op = 'INSERT'
      or (new.role, new.is_banned, new.created_at, new.trust_level_manual)
        is distinct from (old.role, old.is_banned, old.created_at, old.trust_level_manual))
  then
    new.trust_level := private.compute_trust_level(new.id, new.role, new.is_banned, new.created_at);
  end if;
  return new;
end;
$$;

create trigger sync_state
  before insert or update on public.profiles
  for each row execute function private.sync_profile_state();

update public.profiles set trust_level = private.compute_trust_level(id, role, is_banned, created_at);

-- Publishing rights follow the trust level now (level 1+; replaces the rule of D18).
create or replace function private.is_trusted_author(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = user_id and not p.is_banned and p.trust_level >= 1);
$$;

create function private.trust_level_of(user_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select case when p.is_banned then 0 else p.trust_level end from public.profiles p where p.id = user_id), 0)::smallint;
$$;

create or replace function public.my_trust_level()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.trust_level_of((select auth.uid()));
$$;

-- Higher limits (the optional fourth trigger argument) are for level 2 and up.
create or replace function private.enforce_rate_limit()
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

  if tg_nargs > 3 and private.trust_level_of((select auth.uid())) >= 2 then
    max_events := tg_argv[3]::integer;
  end if;

  if not private.take_rate_slot(limited_action, max_events, window_length) then
    raise exception 'rate_limited' using errcode = 'P0001', detail = limited_action,
      hint = 'Too many actions in a short time; try again later.';
  end if;
  return new;
end;
$$;

-- Keep levels current: published cards and confirmed reports change them at once, age and the
-- 14-day window by the hourly job.
create function private.refresh_author_trust()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'reports' then
    perform private.refresh_trust_level(new.target_owner_id);
  else
    perform private.refresh_trust_level(coalesce(new.author_id, old.author_id));
  end if;
  return null;
end;
$$;

create trigger refresh_trust
  after insert or delete or update of status on public.resources
  for each row execute function private.refresh_author_trust();

create trigger refresh_trust
  after update of status on public.reports
  for each row
  when (old.status is distinct from new.status and new.target_owner_id is not null)
  execute function private.refresh_author_trust();

create function private.refresh_all_trust_levels()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p
  set trust_level = private.compute_trust_level(p.id, p.role, p.is_banned, p.created_at)
  where not p.trust_level_manual
    and p.trust_level <> private.compute_trust_level(p.id, p.role, p.is_banned, p.created_at);
$$;

select cron.schedule('refresh-trust-levels', '17 * * * *', $$select private.refresh_all_trust_levels()$$);

-- The banned user and staff can read why and until when.
create function public.ban_details(user_id uuid)
returns table (is_banned boolean, banned_until timestamptz, ban_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.is_banned, p.banned_until, p.ban_reason
  from public.profiles p
  where p.id = user_id and (p.id = (select auth.uid()) or private.is_staff());
$$;

revoke execute on function public.ban_details(uuid) from public, anon;
grant execute on function public.ban_details(uuid) to authenticated;

-- Temporary bans end by themselves.
select cron.schedule(
  'lift-expired-bans',
  '*/10 * * * *',
  $$update public.profiles set is_banned = false where is_banned and banned_until is not null and banned_until <= now()$$
);

-- ---------------------------------------------------------------------------
-- 3. Why the system hid something (resources and comments)
-- ---------------------------------------------------------------------------

alter table public.resources
  add column moderation_state text,
  add constraint resources_moderation_state check (
    moderation_state in ('auto_hidden', 'severe', 'author_banned', 'reputation_flagged')
  );

alter table public.comments
  add column moderation_state text,
  add constraint comments_moderation_state check (moderation_state in ('auto_hidden', 'severe', 'author_banned'));

-- A status change by a person clears the system's reason; the system sets both at once.
create function private.clear_moderation_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.moderation_state is not distinct from old.moderation_state then
    new.moderation_state := null;
  end if;
  return new;
end;
$$;

create trigger track_moderation_state
  before update of status on public.resources
  for each row execute function private.clear_moderation_state();

create trigger track_moderation_state
  before update of status on public.comments
  for each row execute function private.clear_moderation_state();

-- ---------------------------------------------------------------------------
-- 4. In-app notifications (no email): hidden content, bans, warnings, appeal decisions
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  target_type text,
  target_id uuid,
  -- Rule of /qoidalar that applies (a report reason or a moderator's choice), if any.
  rule text,
  -- The moderator's reason, shown to the user.
  message text,
  -- End of a temporary ban.
  until timestamptz,
  created_at timestamptz not null default now(),
  read_at timestamptz,

  constraint notifications_kind check (kind in (
    'content_hidden', 'content_rejected', 'content_restored', 'banned', 'unbanned', 'warning',
    'appeal_accepted', 'appeal_rejected'
  )),
  constraint notifications_target_type check (target_type in ('resource', 'comment', 'user')),
  constraint notifications_rule_length check (char_length(rule) <= 40),
  constraint notifications_message_length check (char_length(message) <= 500)
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

revoke all on table public.notifications from anon, authenticated;
grant select, update (read_at) on table public.notifications to authenticated;
-- Staff write warnings (moderate.warn_user); everything else is written by triggers.
grant insert (user_id, kind, target_type, target_id, rule, message) on table public.notifications to authenticated;

alter table public.notifications enable row level security;

create policy "Users read their notifications"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users mark their notifications read"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Staff can warn other users"
  on public.notifications for insert
  to authenticated
  with check (kind = 'warning' and user_id <> (select auth.uid()) and (select private.is_staff()));

create function private.notify(
  for_user uuid, notice_kind text, notice_target_type text, notice_target_id uuid, notice_rule text,
  notice_message text, notice_until timestamptz default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, target_type, target_id, rule, message, until)
  values (for_user, notice_kind, notice_target_type, notice_target_id, left(notice_rule, 40), left(notice_message, 500), notice_until);
$$;

-- Tells the author when their card or comment is hidden, rejected or restored. Content hidden because
-- the author was banned is covered by the ban notice.
create function private.notify_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notice_kind text;
  notice_rule text := nullif(current_setting('davra.rule', true), '');
  notice_message text := nullif(current_setting('davra.reason', true), '');
begin
  if 'author_banned' in (coalesce(new.moderation_state, ''), coalesce(old.moderation_state, '')) then
    return null;
  end if;
  -- Text, because resources and comments have different status types.
  notice_kind := case
    when new.status::text = 'hidden' then 'content_hidden'
    when new.status::text = 'rejected' then 'content_rejected'
    when new.status::text = 'published' and old.status::text in ('hidden', 'rejected') then 'content_restored'
  end;
  if notice_kind is null then
    return null;
  end if;
  if new.moderation_state = 'severe' then
    -- Do not explain severe-content removals to the author.
    notice_rule := null;
    notice_message := null;
  elsif new.moderation_state = 'reputation_flagged' then
    notice_rule := 'unsafe_link';
  end if;
  perform private.notify(new.author_id, notice_kind, case tg_table_name when 'resources' then 'resource' else 'comment' end,
    new.id, notice_rule, notice_message);
  return null;
end;
$$;

create trigger notify_author
  after update of status on public.resources
  for each row
  when (old.status is distinct from new.status)
  execute function private.notify_status_change();

create trigger notify_author
  after update of status on public.comments
  for each row
  when (old.status is distinct from new.status)
  execute function private.notify_status_change();

-- ---------------------------------------------------------------------------
-- 5. Bans hide the user's content; lifting the ban brings it back
-- ---------------------------------------------------------------------------

create function private.apply_ban()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_banned and not old.is_banned then
    update public.resources set status = 'hidden', moderation_state = 'author_banned'
    where author_id = new.id and status = 'published';
    update public.comments set status = 'hidden', moderation_state = 'author_banned'
    where author_id = new.id and status = 'published';
    perform private.notify(new.id, 'banned', 'user', new.id, nullif(current_setting('davra.rule', true), ''),
      new.ban_reason, new.banned_until);
  elsif old.is_banned and not new.is_banned then
    update public.resources set status = 'published', moderation_state = null
    where author_id = new.id and status = 'hidden' and moderation_state = 'author_banned';
    update public.comments set status = 'published', moderation_state = null
    where author_id = new.id and status = 'hidden' and moderation_state = 'author_banned';
    perform private.notify(new.id, 'unbanned', 'user', new.id, null, null);
  elsif new.is_banned and new.banned_until is distinct from old.banned_until then
    -- The ban was extended or made permanent.
    perform private.notify(new.id, 'banned', 'user', new.id, nullif(current_setting('davra.rule', true), ''),
      new.ban_reason, new.banned_until);
  end if;
  return null;
end;
$$;

create trigger apply_ban
  after update of is_banned, banned_until on public.profiles
  for each row
  when (old.is_banned is distinct from new.is_banned or old.banned_until is distinct from new.banned_until)
  execute function private.apply_ban();

-- ---------------------------------------------------------------------------
-- 6. Severe incidents: a frozen copy kept as evidence (admins only)
-- ---------------------------------------------------------------------------

create table public.severe_incidents (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  -- No foreign key: the evidence outlives the account and the content.
  author_id uuid,
  -- The content as it was when first reported (row as JSON).
  snapshot jsonb not null,
  -- Every severe report on it: reason, details, reporter, time.
  reports jsonb not null default '[]',
  content_created_at timestamptz,
  first_reported_at timestamptz not null default now(),
  status text not null default 'open',
  notes text,
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,

  constraint severe_incidents_target_type check (target_type in ('resource', 'comment', 'user')),
  constraint severe_incidents_status check (status in ('open', 'preserved', 'closed')),
  constraint severe_incidents_notes_length check (char_length(notes) <= 2000)
);

create unique index severe_incidents_open_target on public.severe_incidents (target_type, target_id)
  where status = 'open';
create index severe_incidents_queue_idx on public.severe_incidents (status, first_reported_at);

create trigger track_handling
  before update on public.severe_incidents
  for each row execute function private.track_report_handling();

revoke all on table public.severe_incidents from anon, authenticated;
grant select, update (status, notes) on table public.severe_incidents to authenticated;

alter table public.severe_incidents enable row level security;

create policy "Admins read severe incidents"
  on public.severe_incidents for select
  to authenticated
  using ((select private.is_admin()));

create policy "Admins handle severe incidents"
  on public.severe_incidents for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create function private.preserve_severe(report public.reports)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  content jsonb;
  created timestamptz;
  entry jsonb := jsonb_build_array(jsonb_build_object(
    'report_id', report.id, 'reason', report.reason, 'details', report.details,
    'reporter_id', report.reporter_id, 'reported_at', report.created_at
  ));
begin
  case report.target_type
    when 'resource' then
      select to_jsonb(r) - 'search_vector', r.created_at into content, created from public.resources r where r.id = report.target_id;
    when 'comment' then
      select to_jsonb(c), c.created_at into content, created from public.comments c where c.id = report.target_id;
    when 'user' then
      select to_jsonb(p), p.created_at into content, created from public.profiles p where p.id = report.target_id;
    else
      return;
  end case;

  insert into public.severe_incidents (target_type, target_id, author_id, snapshot, reports, content_created_at)
  values (report.target_type::text, report.target_id, report.target_owner_id, coalesce(content, '{}'), entry, created)
  on conflict (target_type, target_id) where status = 'open'
  do update set reports = public.severe_incidents.reports || excluded.reports;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Reports: weights and automatic hiding
-- ---------------------------------------------------------------------------

-- How much one person's report counts: trusted members more, brand-new accounts less, and people
-- whose recent reports were mostly dismissed much less.
alter table public.reports add column weight numeric(4, 2) not null default 1;

create function private.reporter_weight(reporter uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  person public.profiles;
  base numeric;
  handled integer;
  dismissed integer;
begin
  select * into person from public.profiles where id = reporter;
  if not found then
    return 0.5;
  end if;

  base := case
    when person.role in ('moderator', 'admin') then 3
    when person.trust_level >= 2 then 1.5
    when person.trust_level = 1 then 1
    when person.created_at > now() - interval '1 day' then 0.25
    else 0.5
  end;

  select count(*) filter (where r.status <> 'open'), count(*) filter (where r.status = 'dismissed')
  into handled, dismissed
  from public.reports r
  where r.reporter_id = reporter and r.target_type <> 'broken_link' and r.created_at > now() - interval '90 days';

  if handled >= 5 and dismissed >= handled * 0.8 then
    base := base * 0.25;
  elsif handled >= 3 and dismissed >= handled * 0.6 then
    base := base * 0.5;
  end if;
  return round(base, 2);
end;
$$;

create function private.weigh_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.weight := private.reporter_weight(new.reporter_id);
  return new;
end;
$$;

-- Named to run after prepare_report and the rate limits.
create trigger weigh_report
  before insert on public.reports
  for each row execute function private.weigh_report();

-- Severe reports are limited separately (each one hides content at once).
create trigger rate_limit_severe
  before insert on public.reports
  for each row
  when (new.reason = 'severe')
  execute function private.enforce_rate_limit('report_severe', '3', '1 day');

create function private.apply_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total numeric;
  urgent boolean;
  threshold numeric;
  top_reason text;
  hidden boolean := false;
begin
  if new.target_type not in ('resource', 'comment', 'user') or new.status <> 'open' then
    return null;
  end if;

  if new.reason = 'severe' then
    perform private.preserve_severe(new);
    perform set_config('davra.reason', 'Severe content report', true);
    if new.target_type = 'resource' then
      update public.resources set status = 'hidden', moderation_state = 'severe'
      where id = new.target_id and status in ('published', 'pending');
    elsif new.target_type = 'comment' then
      update public.comments set status = 'hidden', moderation_state = 'severe'
      where id = new.target_id and status in ('published', 'pending');
    end if;
    return null;
  end if;

  if new.target_type = 'user' then
    return null;
  end if;

  select coalesce(sum(r.weight), 0), coalesce(bool_or(r.reason in ('illegal', 'scam_phishing')), false)
  into total, urgent
  from public.reports r
  where r.target_type = new.target_type and r.target_id = new.target_id and r.status = 'open';

  threshold := case
    when urgent then private.setting_number('report_hide_threshold_urgent', 2)
    else private.setting_number('report_hide_threshold', 3)
  end;
  if total < threshold then
    return null;
  end if;

  select r.reason::text into top_reason
  from public.reports r
  where r.target_type = new.target_type and r.target_id = new.target_id and r.status = 'open'
  group by r.reason
  order by sum(r.weight) desc, r.reason
  limit 1;

  perform set_config('davra.rule', top_reason, true);
  perform set_config('davra.reason', 'Hidden automatically after reports', true);
  if new.target_type = 'resource' then
    update public.resources set status = 'hidden', moderation_state = 'auto_hidden'
    where id = new.target_id and status = 'published';
    hidden := found;
  else
    update public.comments set status = 'hidden', moderation_state = 'auto_hidden'
    where id = new.target_id and status = 'published';
    hidden := found;
  end if;

  if hidden then
    insert into public.audit_log (actor_id, action, target_type, target_id, details, reason)
    values (null, new.target_type || '.auto_hide', new.target_type::text, new.target_id::text,
      jsonb_build_object('weight', total, 'threshold', threshold, 'rule', top_reason),
      'Hidden automatically after reports');
  end if;
  return null;
end;
$$;

create trigger apply_report
  after insert on public.reports
  for each row execute function private.apply_report();

-- ---------------------------------------------------------------------------
-- 8. Appeals: one per hidden item or ban
-- ---------------------------------------------------------------------------

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null,
  -- The resource or comment, or the user's own id for a ban.
  target_id uuid not null,
  message text not null,
  status text not null default 'open',
  -- The moderator's answer, shown to the user.
  response text,
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),

  constraint appeals_once unique (user_id, target_type, target_id),
  constraint appeals_target_type check (target_type in ('resource', 'comment', 'ban')),
  constraint appeals_status check (status in ('open', 'accepted', 'rejected')),
  constraint appeals_message_length check (char_length(btrim(message)) between 10 and 1000),
  constraint appeals_response_length check (char_length(response) <= 500)
);

create index appeals_queue_idx on public.appeals (status, created_at);

-- Only what is actually hidden from its own author (or their own ban) can be appealed.
create function private.check_appeal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean := false;
begin
  if new.target_type = 'resource' then
    select exists (
      select 1 from public.resources r
      where r.id = new.target_id and r.author_id = new.user_id and r.status in ('hidden', 'rejected')
    ) into allowed;
  elsif new.target_type = 'comment' then
    select exists (
      select 1 from public.comments c where c.id = new.target_id and c.author_id = new.user_id and c.status = 'hidden'
    ) into allowed;
  elsif new.target_type = 'ban' then
    select exists (
      select 1 from public.profiles p where p.id = new.user_id and p.id = new.target_id and p.is_banned
    ) into allowed;
  end if;
  if not allowed then
    raise exception 'Nothing to appeal' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger check_appeal
  before insert on public.appeals
  for each row execute function private.check_appeal();

create trigger track_handling
  before update on public.appeals
  for each row execute function private.track_report_handling();

create function private.notify_appeal_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('accepted', 'rejected') then
    perform private.notify(new.user_id, 'appeal_' || new.status,
      case new.target_type when 'ban' then 'user' else new.target_type end, new.target_id, null, new.response);
  end if;
  return null;
end;
$$;

create trigger notify_user
  after update of status on public.appeals
  for each row
  when (old.status is distinct from new.status)
  execute function private.notify_appeal_decision();

revoke all on table public.appeals from anon, authenticated;
grant select, insert (target_type, target_id, message), update (status, response) on table public.appeals to authenticated;

alter table public.appeals enable row level security;

-- Banned users may appeal too, so no is_active_user() here.
create policy "Users appeal for themselves"
  on public.appeals for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users see their appeals; staff see all"
  on public.appeals for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

create policy "Staff decide appeals"
  on public.appeals for update
  to authenticated
  using ((select private.is_staff()) and user_id <> (select auth.uid()))
  with check ((select private.is_staff()) and user_id <> (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 9. Audit log: every staff action with its reason (replaces log_moderation)
-- ---------------------------------------------------------------------------

alter table public.audit_log
  add column reason text,
  add constraint audit_log_reason_length check (char_length(reason) <= 500);

create function private.audit(
  actor uuid, audit_action text, audit_target_type text, audit_target_id text, audit_details jsonb,
  audit_reason text, reason_required boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if reason_required and char_length(btrim(coalesce(audit_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = 'P0001', hint = 'Every moderation action needs a reason.';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, details, reason)
  values (actor, audit_action, audit_target_type, audit_target_id, audit_details, left(audit_reason, 500));
end;
$$;

-- Staff actions on other people's content and accounts need a reason (set by the moderation
-- functions with set_config('davra.reason', …)). Changes without a signed-in staff member (jobs,
-- imports, automatic hiding) are not moderator actions and are not logged here.
create or replace function private.log_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  reason text := nullif(current_setting('davra.reason', true), '');
  kind text;
  before_row jsonb;
  after_row jsonb;
begin
  if actor is null or not private.is_staff() then
    return null;
  end if;

  case tg_table_name
    when 'resources' then
      -- A staff member's edits of their own card are not moderation.
      if new.author_id = actor then
        return null;
      end if;
      if new.status is distinct from old.status then
        perform private.audit(actor, 'resource.status', 'resource', new.id::text,
          jsonb_build_object('from', old.status, 'to', new.status, 'title', new.title), reason, true);
      end if;
      if new.link_status is distinct from old.link_status then
        perform private.audit(actor, 'resource.link_status', 'resource', new.id::text,
          jsonb_build_object('from', old.link_status, 'to', new.link_status), reason, false);
      end if;

    when 'comments' then
      if new.author_id = actor then
        return null;
      end if;
      perform private.audit(actor, 'comment.status', 'comment', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status, 'resource_id', new.resource_id), reason, true);

    when 'reports' then
      perform private.audit(actor, 'report.status', 'report', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status, 'target_type', new.target_type,
          'target_id', new.target_id), reason, new.target_type <> 'broken_link');

    when 'removal_requests' then
      perform private.audit(actor, 'removal_request.status', 'removal_request', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status, 'resource_url', new.resource_url), reason, true);

    when 'appeals' then
      perform private.audit(actor, 'appeal.status', 'appeal', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status, 'target_type', new.target_type,
          'target_id', new.target_id), coalesce(reason, new.response), true);

    when 'severe_incidents' then
      perform private.audit(actor, 'severe_incident.status', 'severe_incident', new.id::text,
        jsonb_build_object('from', old.status, 'to', new.status), reason, false);

    when 'app_settings' then
      perform private.audit(actor, 'setting.update', 'setting', new.key,
        jsonb_build_object('from', old.value, 'to', new.value), reason, false);

    when 'notifications' then
      perform private.audit(actor, 'user.warn', 'user', new.user_id::text,
        jsonb_build_object('rule', new.rule), new.message, true);

    when 'profiles' then
      if new.is_banned is distinct from old.is_banned or (new.is_banned and new.banned_until is distinct from old.banned_until) then
        perform private.audit(actor, case when new.is_banned then 'user.ban' else 'user.unban' end, 'user', new.id::text,
          jsonb_build_object('username', new.username, 'until', new.banned_until), reason, true);
      end if;
      if new.role is distinct from old.role then
        perform private.audit(actor, 'user.role', 'user', new.id::text,
          jsonb_build_object('username', new.username, 'from', old.role, 'to', new.role), reason, true);
      end if;
      if new.trust_level_manual is distinct from old.trust_level_manual
        or (new.trust_level_manual and new.trust_level is distinct from old.trust_level)
      then
        perform private.audit(actor, 'user.trust', 'user', new.id::text,
          jsonb_build_object('username', new.username, 'from', old.trust_level, 'to', new.trust_level,
            'manual', new.trust_level_manual), reason, true);
      end if;

    when 'topics', 'blocked_domains', 'blocked_terms' then
      if tg_op in ('UPDATE', 'DELETE') then
        before_row := to_jsonb(old);
      end if;
      if tg_op in ('INSERT', 'UPDATE') then
        after_row := to_jsonb(new);
      end if;
      kind := case tg_table_name when 'topics' then 'topic' when 'blocked_domains' then 'blocked_domain' else 'blocked_term' end;
      perform private.audit(actor, kind || '.' || lower(tg_op), kind,
        coalesce(after_row, before_row) ->> case kind when 'topic' then 'id' when 'blocked_domain' then 'domain' else 'term' end,
        jsonb_build_object('before', before_row, 'after', after_row), reason, false);
  end case;

  return null;
end;
$$;

drop trigger log_moderation on public.profiles;
create trigger log_moderation
  after update on public.profiles
  for each row
  when (
    old.is_banned is distinct from new.is_banned
    or old.banned_until is distinct from new.banned_until
    or old.role is distinct from new.role
    or old.trust_level_manual is distinct from new.trust_level_manual
    or (new.trust_level_manual and old.trust_level is distinct from new.trust_level)
  )
  execute function private.log_moderation();

create trigger log_moderation
  after update on public.appeals
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_moderation();

create trigger log_moderation
  after update on public.severe_incidents
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_moderation();

create trigger log_moderation
  after update on public.app_settings
  for each row
  when (old.value is distinct from new.value)
  execute function private.log_moderation();

create trigger log_moderation
  after insert on public.notifications
  for each row
  when (new.kind = 'warning')
  execute function private.log_moderation();

revoke execute on all functions in schema private from public;
grant execute on function private.setting_number(text, numeric) to anon, authenticated, service_role;
grant execute on function private.trust_level_of(uuid) to authenticated, service_role;
-- Called by triggers that run as the writing user.
grant execute on function private.reporter_weight(uuid) to authenticated, service_role;
grant execute on function private.compute_trust_level(uuid, public.user_role, boolean, timestamptz) to authenticated, service_role;
