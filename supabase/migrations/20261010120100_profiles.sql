-- Profiles: one row per auth user, created by a trigger on sign-up. Role and ban state live here.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  university text,
  field_of_study text,
  role public.user_role not null default 'user',
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_key unique (username),
  -- Lower-case only, so uniqueness is case-insensitive and /u/[username] URLs are canonical.
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  constraint profiles_avatar_url_format check (avatar_url ~ '^https?://' and char_length(avatar_url) <= 500),
  constraint profiles_bio_length check (char_length(bio) <= 300),
  constraint profiles_university_length check (char_length(university) <= 120),
  constraint profiles_field_of_study_length check (char_length(field_of_study) <= 120)
);

-- ---------------------------------------------------------------------------
-- Role helpers used by RLS policies and triggers. SECURITY DEFINER so they can read profiles
-- regardless of the caller's policies; STABLE so Postgres evaluates them once per statement when
-- wrapped in `(select ...)`. Banned staff lose their powers.
-- ---------------------------------------------------------------------------

create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and not is_banned
  );
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('moderator', 'admin') and not is_banned
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and not is_banned
  );
$$;

grant execute on function private.is_active_user() to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profile creation on sign-up
-- ---------------------------------------------------------------------------

-- Reads `username` and `display_name` from the sign-up metadata. An invalid or taken username gets a
-- random suffix instead of failing the sign-up; the user can change it in settings. The username is
-- never derived from the email address, because usernames are public.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  display text := btrim(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60));
  base text;
  candidate text;
begin
  if requested ~ '^[a-z0-9_]{3,30}$' then
    base := left(requested, 23);
    candidate := requested;
  else
    base := 'user';
    candidate := base || '_' || substr(md5(gen_random_uuid()::text), 1, 6);
  end if;

  loop
    insert into public.profiles (id, username, display_name)
    values (new.id, candidate, coalesce(nullif(display, ''), candidate))
    on conflict (username) do nothing;
    exit when found;
    candidate := base || '_' || substr(md5(gen_random_uuid()::text), 1, 6);
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guard: who may change which profile columns through the Data API.
-- Trusted server code (service role, migrations, jobs) is not restricted.
-- ---------------------------------------------------------------------------

create function private.guard_profile_update()
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
    and (new.username, new.display_name, new.avatar_url, new.bio, new.university, new.field_of_study)
      is distinct from (old.username, old.display_name, old.avatar_url, old.bio, old.university, old.field_of_study)
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

create trigger guard_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

create trigger set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update (username, display_name, avatar_url, bio, university, field_of_study, role, is_banned)
  on table public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Owners edit their own profile; staff may update others (ban/role), limited by the guard trigger.
create policy "Owners and staff can update profiles"
  on public.profiles for update
  to authenticated
  using ((id = (select auth.uid()) and (select private.is_active_user())) or (select private.is_staff()))
  with check ((id = (select auth.uid()) and (select private.is_active_user())) or (select private.is_staff()));

revoke execute on all functions in schema private from public;
