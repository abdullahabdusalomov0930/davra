-- Rate limits on user actions, and the removal-request queue.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- N = new user, T = trusted author, M = moderator, A = author of the cards everyone interacts with.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000081', 'n81@test.uz', '{"username": "limit_new"}'),
  ('00000000-0000-4000-8000-000000000082', 't82@test.uz', '{"username": "limit_trusted"}'),
  ('00000000-0000-4000-8000-000000000083', 'm83@test.uz', '{"username": "limit_mod"}'),
  ('00000000-0000-4000-8000-000000000084', 'a84@test.uz', '{"username": "limit_author"}');
update public.profiles set created_at = now() - interval '10 days'
  where id = '00000000-0000-4000-8000-000000000082';
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000083';

-- T has 3 published cards (trusted); A has 101 published cards to like and save.
insert into public.resources (slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status)
select 'limit-' || who || '-' || n, author, (select id from public.topics where slug = 'dasturlash'),
  'Limit test ' || n, 'https://example.com/limit/' || who || '/' || n, 'website', 'uz', 'free', 'all',
  'Rate limit testlari uchun yaratilgan resurs, uning matni yetarlicha uzun.', 'Testlar uchun yozilgan',
  'published'
from (values ('t', '00000000-0000-4000-8000-000000000082'::uuid, 3), ('a', '00000000-0000-4000-8000-000000000084'::uuid, 101))
  as authors(who, author, total),
  generate_series(1, authors.total) as n;

create function pg_temp.new_card(n integer)
returns void
language sql
as $$
  insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
  values ('limit-card-' || (select auth.uid())::text || '-' || n, (select id from public.topics where slug = 'matematika'),
    'Yangi karta ' || n, 'https://example.com/limit/new/' || (select auth.uid())::text || '/' || n,
    'website', 'uz', 'free', 'all',
    'Rate limit testlari uchun yaratilgan resurs, uning matni yetarlicha uzun.', 'Testlar uchun yozilgan');
$$;

-- New resources ------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000081", "role": "authenticated"}';

select lives_ok($$select pg_temp.new_card(n) from generate_series(1, 3) as n$$, 'a new user can share 3 resources a day');
select throws_ok($$select pg_temp.new_card(4)$$, 'P0001', 'rate_limited', 'the 4th resource of the day is refused');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000082", "role": "authenticated"}';

select lives_ok($$select pg_temp.new_card(n) from generate_series(1, 10) as n$$, 'a trusted author can share 10 a day');
select throws_ok($$select pg_temp.new_card(11)$$, 'P0001', 'rate_limited', 'the 11th is refused');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000083", "role": "authenticated"}';

select lives_ok($$select pg_temp.new_card(n) from generate_series(1, 12) as n$$, 'staff are not limited');

reset role;
set local request.jwt.claims = '';

select lives_ok(
  $$insert into public.resources (slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status)
    select 'limit-import-' || n, '00000000-0000-4000-8000-000000000081', (select id from public.topics where slug = 'dasturlash'),
      'Import ' || n, 'https://example.com/limit/import/' || n, 'website', 'uz', 'free', 'all',
      'Rate limit testlari uchun yaratilgan resurs, uning matni yetarlicha uzun.', 'Testlar uchun yozilgan', 'published'
    from generate_series(1, 5) as n$$,
  'trusted server code (imports) is not limited'
);

-- Likes and saves: 100 per hour together ----------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000081", "role": "authenticated"}';

select lives_ok(
  $$insert into public.resource_likes (resource_id)
    select id from public.resources where slug like 'limit-a-%' order by slug limit 60$$,
  '60 likes'
);
select lives_ok(
  $$insert into public.resource_saves (resource_id)
    select id from public.resources where slug like 'limit-a-%' order by slug limit 40$$,
  'and 40 saves in the same hour'
);
select throws_ok(
  $$insert into public.resource_saves (resource_id) select id from public.resources where slug = 'limit-a-99'$$,
  'P0001', 'rate_limited',
  'the 101st like or save in an hour is refused'
);

delete from public.resource_likes where resource_id = (select id from public.resources where slug = 'limit-a-1');
select throws_ok(
  $$insert into public.resource_likes (resource_id) select id from public.resources where slug = 'limit-a-1'$$,
  'P0001', 'rate_limited',
  'unliking and liking again does not free a slot (events are counted, not rows)'
);

-- Comments: 30 per day ------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000082", "role": "authenticated"}';

select lives_ok(
  $$insert into public.comments (resource_id, body)
    select (select id from public.resources where slug = 'limit-a-1'), 'Izoh ' || n from generate_series(1, 30) as n$$,
  '30 comments a day'
);
select throws_ok(
  $$insert into public.comments (resource_id, body) values ((select id from public.resources where slug = 'limit-a-1'), 'Yana')$$,
  'P0001', 'rate_limited',
  'the 31st comment is refused'
);

-- Failed inserts do not use up the limit -----------------------------------------------------

select throws_ok(
  $$insert into public.resource_likes (resource_id) select id from public.resources where slug = 'limit-t-1'$$,
  '42501', null,
  'liking your own card is refused by RLS'
);

reset role;
set local request.jwt.claims = '';
select is(
  (select count(*)::integer from private.rate_events where user_id = '00000000-0000-4000-8000-000000000082' and action = 'like_or_save'),
  0,
  'a refused insert leaves no event behind'
);

-- Reports: 20 per day ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000081", "role": "authenticated"}';

select lives_ok(
  $$insert into public.reports (target_type, target_id, reason)
    select 'resource', id, 'spam' from public.resources where slug like 'limit-a-%' order by slug limit 20$$,
  '20 reports a day'
);
select throws_ok(
  $$insert into public.reports (target_type, target_id, reason)
    select 'resource', id, 'spam' from public.resources where slug = 'limit-a-99'$$,
  'P0001', 'rate_limited',
  'the 21st report is refused'
);

select throws_ok(
  $$select count(*) from private.rate_events$$,
  '42501', null,
  'users cannot read the events table'
);

-- Removal requests ---------------------------------------------------------------------------------

reset role;
set local request.jwt.claims = '';
insert into public.removal_requests (id, resource_url, requester_name, requester_email, details, ip_hash)
values ('00000000-0000-4000-8000-000000000089', 'https://davra.uz/resurs/limit-a-1', 'Nashriyot vakili',
  'legal@example.com', 'Bu kitobning toʻliq nusxasi ruxsatsiz joylangan, iltimos olib tashlang.', 'hash');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$insert into public.removal_requests (resource_url, requester_name, requester_email, details, ip_hash)
    values ('x', 'Ism Familiya', 'a@b.uz', 'Juda uzun tushuntirish matni shu yerda yoziladi.', 'h')$$,
  '42501', null,
  'the Data API cannot create removal requests (only the server can)'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000081", "role": "authenticated"}';
select is_empty($$select 1 from public.removal_requests$$, 'regular users cannot read removal requests');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000083", "role": "authenticated"}';
update public.removal_requests set status = 'resolved' where id = '00000000-0000-4000-8000-000000000089';

reset role;
set local request.jwt.claims = '';
select results_eq(
  $$select r.handled_by::text, a.action, a.actor_id::text
    from public.removal_requests r
    join public.audit_log a on a.target_id = r.id::text
    where r.id = '00000000-0000-4000-8000-000000000089'$$,
  $$values ('00000000-0000-4000-8000-000000000083', 'removal_request.status', '00000000-0000-4000-8000-000000000083')$$,
  'staff handle removal requests; the handler is recorded and the action audited'
);

select * from finish();
rollback;
