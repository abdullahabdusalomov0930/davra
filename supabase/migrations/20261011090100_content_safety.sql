-- Content safety (security addendum, X1; DECISIONS.md D64–D66).
--
-- 1. Profile photos are gone: profiles show initials, and no file can be uploaded anywhere.
-- 2. Every text a signed-in user writes through the Data API (resource cards, comments, review texts,
--    profile fields) must first pass the app server's safety check: the server issues a single-use
--    "safety ticket" for exactly that content, and these triggers refuse content without one. A user
--    who calls the Data API directly cannot skip the word filter or the link policy.
-- 3. A ticket says "allow" or "needs_review"; the latter keeps resources and comments for a moderator.
-- 4. The server records why it rejected or held something in moderation_events (staff only).

-- ---------------------------------------------------------------------------
-- 1. No profile photos
-- ---------------------------------------------------------------------------

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

  if new.is_banned is distinct from old.is_banned then
    if is_self or not private.is_staff() then
      raise exception 'Only staff can ban or unban another user' using errcode = '42501';
    end if;
    if old.role <> 'user' and not private.is_admin() then
      raise exception 'Only an admin can ban or unban staff' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

alter table public.profiles drop column avatar_url;

-- The avatars bucket stops serving files and accepting uploads. Its files are deleted from the
-- dashboard (Storage → avatars → delete bucket); Storage does not let SQL delete them.
drop policy if exists "Users can read their own avatar files" on storage.objects;
drop policy if exists "Active users can upload their avatar" on storage.objects;
drop policy if exists "Active users can replace their avatar" on storage.objects;
drop policy if exists "Active users can delete their avatar" on storage.objects;
update storage.buckets set public = false where id = 'avatars';

-- ---------------------------------------------------------------------------
-- 2. Safety tickets
-- ---------------------------------------------------------------------------

-- Fields of one submission joined with the unit separator, as the server joins them (src/server/safety/tickets.ts).
create function private.content_hash(variadic parts text[])
returns text
language sql
immutable
set search_path = ''
return encode(sha256(convert_to(array_to_string(parts, chr(31), ''), 'UTF8')), 'hex');

create table private.safety_tickets (
  user_id uuid not null,
  kind text not null check (kind in ('resource', 'comment', 'rating', 'profile')),
  content_hash text not null,
  decision text not null check (decision in ('allow', 'needs_review')),
  -- Where the link really leads and what the reputation service said, found by the server.
  final_url text,
  reputation text check (reputation in ('unknown', 'safe', 'flagged')),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, content_hash)
);

revoke all on table private.safety_tickets from public, anon, authenticated;

-- Issued by the app server (secret key) after its checks; a newer ticket for the same content replaces
-- the older one.
create function public.issue_safety_ticket(
  for_user uuid,
  kind text,
  content_hash text,
  decision text,
  final_url text default null,
  reputation text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.safety_tickets (user_id, kind, content_hash, decision, final_url, reputation)
  values (for_user, kind, content_hash, decision, final_url, reputation)
  on conflict (user_id, kind, content_hash) do update
    set decision = excluded.decision, final_url = excluded.final_url, reputation = excluded.reputation,
        created_at = now();
$$;

revoke execute on function public.issue_safety_ticket(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.issue_safety_ticket(uuid, text, text, text, text, text) to service_role;

-- Uses up the signed-in user's ticket for this content, or refuses the write.
create function private.take_safety_ticket(ticket_kind text, ticket_hash text)
returns private.safety_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket private.safety_tickets;
begin
  delete from private.safety_tickets t
  where t.user_id = (select auth.uid()) and t.kind = ticket_kind and t.content_hash = ticket_hash
    and t.created_at > now() - interval '15 minutes'
  returning * into ticket;

  if ticket.user_id is null then
    raise exception 'unchecked_submission' using errcode = 'P0001',
      hint = 'Content must be submitted through the app, which checks it first.';
  end if;
  return ticket;
end;
$$;

-- Leftover tickets (the write failed for another reason) expire; clear them daily.
select cron.schedule(
  'prune-safety-tickets',
  '45 22 * * *',
  $$delete from private.safety_tickets where created_at < now() - interval '1 day'$$
);

-- Data API writes only: trusted server code (imports, seeds, jobs) is not checked here.
create function private.is_api_write()
returns boolean
language sql
stable
set search_path = ''
return current_user in ('anon', 'authenticated');

-- Resources: the link (and where it really leads) and every text field.
alter table public.resources
  add column final_url text,
  add column reputation_status text not null default 'unknown',
  add constraint resources_final_url_format check (final_url ~ '^https?://' and char_length(final_url) <= 2048),
  add constraint resources_reputation_status check (reputation_status in ('unknown', 'safe', 'flagged'));

create function private.check_resource_safety()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ticket private.safety_tickets;
begin
  if not private.is_api_write() then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and (new.url, new.title, new.summary, new.for_whom, new.author_review)
      is not distinct from (old.url, old.title, old.summary, old.for_whom, old.author_review)
  then
    return new;
  end if;

  ticket := private.take_safety_ticket('resource',
    private.content_hash(new.url, new.title, new.summary, new.for_whom, coalesce(new.author_review, '')));

  new.final_url := ticket.final_url;
  new.reputation_status := coalesce(ticket.reputation, 'unknown');
  if ticket.final_url is not null and private.is_blocked_domain(private.url_host(ticket.final_url)) then
    raise exception 'blocked_domain' using errcode = 'P0001', hint = 'The link leads to a blocked domain.';
  end if;
  if ticket.decision = 'needs_review' then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

-- Named to run after prepare_insert/prepare_update (status by trust) and rate_limit.
create trigger safety_check
  before insert or update on public.resources
  for each row execute function private.check_resource_safety();

-- Comments.
create function private.check_comment_safety()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ticket private.safety_tickets;
begin
  if not private.is_api_write() then
    return new;
  end if;
  ticket := private.take_safety_ticket('comment', private.content_hash(new.resource_id::text, new.body));
  if ticket.decision = 'needs_review' then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

create trigger safety_check
  before insert on public.comments
  for each row execute function private.check_comment_safety();

-- Pending comments are visible to their author and staff (the existing select policy), are not
-- counted (comments_count counts published ones), and staff publish or hide them.

-- Review texts of ratings. Ratings have no review queue, so only "allow" is accepted.
create function private.check_rating_safety()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ticket private.safety_tickets;
begin
  if not private.is_api_write() or new.review_text is null
    or (tg_op = 'UPDATE' and new.review_text is not distinct from old.review_text)
  then
    return new;
  end if;
  ticket := private.take_safety_ticket('rating', private.content_hash(new.resource_id::text, new.review_text));
  if ticket.decision <> 'allow' then
    raise exception 'unchecked_submission' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger safety_check
  before insert or update on public.resource_ratings
  for each row execute function private.check_rating_safety();

-- Profile texts. Accounts are created by Supabase Auth (not through this check); usernames and names
-- given at sign-up are checked when sign-up moves to the server (addendum X4).
create function private.check_profile_safety()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ticket private.safety_tickets;
begin
  if not private.is_api_write()
    or (new.username, new.display_name, new.bio, new.university, new.field_of_study)
      is not distinct from (old.username, old.display_name, old.bio, old.university, old.field_of_study)
  then
    return new;
  end if;
  ticket := private.take_safety_ticket('profile', private.content_hash(new.username, new.display_name,
    coalesce(new.bio, ''), coalesce(new.university, ''), coalesce(new.field_of_study, '')));
  if ticket.decision <> 'allow' then
    raise exception 'unchecked_submission' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger safety_check
  before update on public.profiles
  for each row execute function private.check_profile_safety();

-- ---------------------------------------------------------------------------
-- 3. Trust level as the server sees it (a column with promotion rules comes in X2)
-- ---------------------------------------------------------------------------

-- 0 new, 1 trusted author, 3 staff; banned users are 0.
create function public.my_trust_level()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.is_banned then 0
    when p.role in ('moderator', 'admin') then 3
    when private.is_trusted_author(p.id) then 1
    else 0
  end
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke execute on function public.my_trust_level() from public, anon;
grant execute on function public.my_trust_level() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Moderation events: why the safety check held or rejected a submission
-- ---------------------------------------------------------------------------

create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('resource', 'comment', 'rating', 'profile')),
  -- The held resource or comment; null when the submission was rejected.
  target_id uuid,
  decision text not null check (decision in ('needs_review', 'reject')),
  -- Internal reason codes (e.g. "text.scam:summary", "url.shortener"); never shown to the author.
  reasons text[] not null,
  -- Start of the submitted text, so moderators can see what was refused.
  excerpt text check (char_length(excerpt) <= 300),
  created_at timestamptz not null default now()
);

create index moderation_events_target_idx on public.moderation_events (target_type, target_id);
create index moderation_events_user_idx on public.moderation_events (user_id, created_at desc);

revoke all on table public.moderation_events from anon, authenticated;
grant select on table public.moderation_events to authenticated;

alter table public.moderation_events enable row level security;

create policy "Staff can read moderation events"
  on public.moderation_events for select
  to authenticated
  using ((select private.is_staff()));

-- Kept for half a year: enough to spot repeat offenders, no longer than needed.
select cron.schedule(
  'prune-moderation-events',
  '50 22 * * *',
  $$delete from public.moderation_events where created_at < now() - interval '180 days'$$
);

revoke execute on all functions in schema private from public;
-- The safety triggers run as the writing user (invoker), so these must be callable by them. The private
-- schema is not exposed through the Data API, so users cannot call them directly.
grant execute on function private.content_hash(text[]) to anon, authenticated, service_role;
grant execute on function private.is_api_write() to anon, authenticated, service_role;
grant execute on function private.take_safety_ticket(text, text) to authenticated;
