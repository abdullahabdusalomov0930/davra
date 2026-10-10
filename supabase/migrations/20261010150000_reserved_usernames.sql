-- Reserved usernames: names that would look official or collide with app words. Enforced here so
-- that no client (including direct Data API calls) can take them; the forms check the same list.
-- Keep in sync with RESERVED_USERNAMES in src/lib/validators/profile.ts (a unit test compares them).

create function private.is_reserved_username(name text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
return name = any (array[
  'admin', 'administrator', 'api', 'auth', 'davra', 'help', 'info', 'kirish', 'mod', 'moderator',
  'null', 'official', 'root', 'security', 'sozlamalar', 'staff', 'support', 'system', 'undefined', 'yordam'
]);

grant execute on function private.is_reserved_username(text) to authenticated, service_role;

alter table public.profiles
  add constraint profiles_username_not_reserved check (not private.is_reserved_username(username));

-- Sign-up: a reserved username is treated like an invalid one (random fallback, never a failed sign-up).
create or replace function private.handle_new_user()
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
  if requested ~ '^[a-z0-9_]{3,30}$' and not private.is_reserved_username(requested) then
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

revoke execute on all functions in schema private from public;
