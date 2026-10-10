-- "Haftalik Top 10": last week's likes, saves and counted ratings, public resources only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- A = author, B and C = readers (old enough for their ratings to count).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'wa@test.uz', '{"username": "haftalik_a"}'),
  ('00000000-0000-4000-8000-0000000000b1', 'wb@test.uz', '{"username": "haftalik_b"}'),
  ('00000000-0000-4000-8000-0000000000c1', 'wc@test.uz', '{"username": "haftalik_c"}'),
  ('00000000-0000-4000-8000-0000000000d1', 'wd@test.uz', '{"username": "haftalik_yangi"}');
update public.profiles set created_at = now() - interval '30 days'
  where id in ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1');

insert into public.resources (id, slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status, link_status)
select ('00000000-0000-4000-8000-00000000010' || n)::uuid, 'weekly-' || n, '00000000-0000-4000-8000-0000000000a1',
  (select id from public.topics where slug = 'dasturlash'), 'Haftalik ' || n, 'https://example.com/weekly/' || n,
  'website', 'uz', 'free', 'all', 'Haftalik reyting testlari uchun yozilgan resurs matni, yetarlicha uzun.',
  'Testlar uchun yozilgan', status::public.resource_status, link::public.link_status
from (values (1, 'published', 'ok'), (2, 'published', 'ok'), (3, 'published', 'ok'), (4, 'published', 'unknown'),
  (5, 'pending', 'unknown'), (6, 'published', 'broken')) as v(n, status, link);

-- 1: two likes this week (2 points). 2: a save and a 5-star rating (2 + 2 = 4 points).
-- 3: a like eight days ago (too old). 4: a like and a 1-star rating (1 - 2 = -1).
-- 5 (pending) and 6 (broken link) get likes but are not public or not working.
insert into public.resource_likes (user_id, resource_id, created_at) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000101', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000101', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000103', now() - interval '8 days'),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000104', now()),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000105', now()),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000106', now()),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000106', now());
insert into public.resource_saves (user_id, resource_id) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000102');
insert into public.resource_ratings (user_id, resource_id, stars) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000102', 5),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000104', 1),
  -- A brand-new account's rating is shown but not counted, here as everywhere.
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000103', 5);

create function pg_temp.top(max_count integer default 10)
returns text[]
language sql
as $$
  select coalesce(array_agg(r.slug order by f.n), '{}')
  from public.weekly_top_resources(max_count) with ordinality as f(resource_id, l, s, rt, p, n)
  join public.resources r on r.id = f.resource_id
  where r.slug like 'weekly-%';
$$;

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(pg_temp.top(), array['weekly-2', 'weekly-1'], 'guests see the week''s top: most points first');
select is(
  (select row(week_likes, week_saves, week_ratings, week_points)::text
   from public.weekly_top_resources() where resource_id = '00000000-0000-4000-8000-000000000102'),
  '(0,1,1,4)',
  'a save counts 2 and a 5-star rating 2'
);
select ok(not ('weekly-3' = any(pg_temp.top())), 'activity older than 7 days does not count');
select ok(not ('weekly-4' = any(pg_temp.top())), 'a low rating can outweigh a like: no points, no place');
select ok(not ('weekly-5' = any(pg_temp.top())), 'pending resources are not listed');
select ok(not ('weekly-6' = any(pg_temp.top())), 'broken links are not listed');
select is(pg_temp.top(1), array['weekly-2'], 'max_count limits the list');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated"}';
select is(pg_temp.top(), array['weekly-2', 'weekly-1'], 'signed-in users see the same list');
select is_empty(
  $$select 1 from public.resource_likes where user_id <> '00000000-0000-4000-8000-0000000000d1'$$,
  'and still cannot read other people''s likes'
);

select * from finish();
rollback;
