-- Profiles: creation on sign-up, who may edit what, bans and roles.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Users: 1 = regular, 2 = second regular, 3 = moderator, 4 = admin.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'one@test.uz', '{"username": "Nodira_01", "display_name": "  Nodira  "}'),
  ('00000000-0000-4000-8000-000000000002', 'two@test.uz', '{"username": "nodira_01"}'),
  ('00000000-0000-4000-8000-000000000003', 'mod@test.uz', '{"username": "moderator"}'),
  ('00000000-0000-4000-8000-000000000004', 'admin@test.uz', '{"username": "admin"}'),
  ('00000000-0000-4000-8000-000000000005', 'five@test.uz', '{"username": "x!"}'),
  ('00000000-0000-4000-8000-000000000006', 'six@test.uz', '{"username": "Admin"}');
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000004';

-- Sign-up -------------------------------------------------------------------

select is(
  (select username || '|' || display_name || '|' || role from public.profiles where id = '00000000-0000-4000-8000-000000000001'),
  'nodira_01|Nodira|user',
  'sign-up creates a profile with the lower-cased username, trimmed display name and role "user"'
);

select matches(
  (select username from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  '^nodira_01_[0-9a-f]{6}$',
  'a taken username gets a random suffix instead of failing the sign-up'
);

select matches(
  (select username from public.profiles where id = '00000000-0000-4000-8000-000000000005'),
  '^user_[0-9a-f]{6}$',
  'an invalid username falls back to user_xxxxxx (never the email address)'
);

select throws_ok(
  $$update public.profiles set username = 'Nodira' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'usernames must be lower-case'
);

select matches(
  (select username from public.profiles where id = '00000000-0000-4000-8000-000000000006'),
  '^user_[0-9a-f]{6}$',
  'a reserved username falls back to user_xxxxxx'
);

select throws_ok(
  $$update public.profiles set username = 'moderator' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'reserved usernames cannot be taken later either'
);

-- Guests --------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select count(*)::integer from public.profiles where id::text like '00000000-0000-4000-8000-%'),
  6,
  'guests can read profiles'
);

select throws_ok(
  $$update public.profiles set bio = 'x'$$,
  '42501', null,
  'guests cannot update profiles'
);

-- A regular user --------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$update public.profiles set bio = 'Fizika talabasi', university = 'TATU' where id = '00000000-0000-4000-8000-000000000001'$$,
  'users can edit their own profile'
);

update public.profiles set bio = 'hacked' where id = '00000000-0000-4000-8000-000000000002';

select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'users cannot change their own role'
);

update public.profiles set is_banned = true where id = '00000000-0000-4000-8000-000000000002';

select is(
  (select is_banned from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  false,
  'users cannot ban others (RLS filters the row out)'
);

select throws_ok(
  $$update public.profiles set is_banned = true where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'users cannot change their own ban state'
);

select throws_ok(
  $$update public.profiles set created_at = now() - interval '1 year' where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'users cannot backdate their account (no privilege on created_at)'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select bio from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  null,
  'users cannot edit someone else''s profile (RLS filters the row out)'
);

-- Moderator -------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000003", "role": "authenticated"}';

select lives_ok(
  $$update public.profiles set is_banned = true where id = '00000000-0000-4000-8000-000000000002'$$,
  'moderators can ban a regular user'
);

select throws_ok(
  $$update public.profiles set bio = 'edited by staff' where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'moderators cannot edit other users'' profile content'
);

select throws_ok(
  $$update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'moderators cannot change roles'
);

select throws_ok(
  $$update public.profiles set is_banned = true where id = '00000000-0000-4000-8000-000000000004'$$,
  '42501', null,
  'moderators cannot ban staff'
);

select results_eq(
  $$select action, actor_id::text, target_id from public.audit_log order by created_at$$,
  $$values ('user.ban', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002')$$,
  'the ban is written to the audit log with the moderator as actor'
);

-- Banned user -------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000002", "role": "authenticated"}';

update public.profiles set bio = 'still here' where id = '00000000-0000-4000-8000-000000000002';

select is_empty(
  $$select 1 from public.audit_log$$,
  'regular users cannot read the audit log'
);

reset role;
set local request.jwt.claims = '';

select is(
  (select bio from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  null,
  'banned users are read-only, even for their own profile'
);

-- Admin -----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000004", "role": "authenticated"}';

select lives_ok(
  $$update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000001'$$,
  'admins can promote a user to moderator'
);

select lives_ok(
  $$update public.profiles set is_banned = false where id = '00000000-0000-4000-8000-000000000002'$$,
  'admins can unban'
);

select throws_ok(
  $$update public.profiles set role = 'user' where id = '00000000-0000-4000-8000-000000000004'$$,
  '42501', null,
  'admins cannot change their own role (no accidental lock-out)'
);

select results_eq(
  $$select action, details ->> 'to' from public.audit_log where actor_id = '00000000-0000-4000-8000-000000000004' order by action$$,
  $$values ('user.role', 'moderator'), ('user.unban', null)$$,
  'role changes and unbans are audited'
);

select * from finish();
rollback;
