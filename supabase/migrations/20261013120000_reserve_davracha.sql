-- The product is now called Davracha (DECISIONS.md D81). Its name is reserved as a username, like the old
-- name before it, so nobody can pose as the official account. Same function as in
-- 20261010150000_reserved_usernames.sql with one more entry; the check constraint keeps using it.
-- Keep in sync with RESERVED_USERNAMES in src/lib/validators/profile.ts (a unit test compares them).

create or replace function private.is_reserved_username(name text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
return name = any (array[
  'admin', 'administrator', 'api', 'auth', 'davra', 'davracha', 'help', 'info', 'kirish', 'mod', 'moderator',
  'null', 'official', 'root', 'security', 'sozlamalar', 'staff', 'support', 'system', 'undefined', 'yordam'
]);
