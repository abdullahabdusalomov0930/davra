-- "Obunalarim": search_resources(following_only => true) lists resources from followed people and topics.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- R = reader, A and B = authors.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000071', 'reader@test.uz', '{"username": "oquvchi"}'),
  ('00000000-0000-4000-8000-000000000072', 'a@test.uz', '{"username": "muallif_a"}'),
  ('00000000-0000-4000-8000-000000000073', 'b@test.uz', '{"username": "muallif_b"}');

insert into public.resources
  (slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status, published_at)
values
  ('a-dasturlash', '00000000-0000-4000-8000-000000000072', (select id from public.topics where slug = 'dasturlash'),
    'A: dasturlash', 'https://example.com/f/1', 'video', 'uz', 'free', 'beginner',
    'Muallif A ning dasturlash boʻyicha resursi, obuna lentasini tekshirish uchun.', 'Tekshiruv uchun yozilgan',
    'published', now() - interval '3 days'),
  ('a-matematika', '00000000-0000-4000-8000-000000000072', (select id from public.topics where slug = 'matematika'),
    'A: matematika', 'https://example.com/f/2', 'book', 'uz', 'free', 'beginner',
    'Muallif A ning matematika boʻyicha resursi, obuna lentasini tekshirish uchun.', 'Tekshiruv uchun yozilgan',
    'published', now() - interval '2 days'),
  ('b-dizayn', '00000000-0000-4000-8000-000000000073', (select id from public.topics where slug = 'dizayn'),
    'B: dizayn', 'https://example.com/f/3', 'course', 'uz', 'free', 'beginner',
    'Muallif B ning dizayn boʻyicha resursi, obuna lentasini tekshirish uchun yozilgan.', 'Tekshiruv uchun yozilgan',
    'published', now() - interval '1 day'),
  ('b-dasturlash', '00000000-0000-4000-8000-000000000073', (select id from public.topics where slug = 'dasturlash'),
    'B: dasturlash', 'https://example.com/f/4', 'article', 'uz', 'free', 'beginner',
    'Muallif B ning dasturlash boʻyicha resursi, obuna lentasini tekshirish uchun.', 'Tekshiruv uchun yozilgan',
    'published', now() - interval '4 days'),
  ('b-pending', '00000000-0000-4000-8000-000000000073', (select id from public.topics where slug = 'dizayn'),
    'B: pending', 'https://example.com/f/5', 'course', 'uz', 'free', 'beginner',
    'Muallif B ning tekshiruvdagi resursi, obuna lentasida koʻrinmasligi kerak boʻlgan.', 'Tekshiruv uchun yozilgan',
    'pending', null);

create function pg_temp.feed()
returns text[]
language sql
as $$
  select coalesce(array_agg(r.slug order by f.n), '{}')
  from public.search_resources(following_only => true) with ordinality as f(id, next_cursor, n)
  join public.resources r on r.id = f.id
  where r.slug in ('a-dasturlash', 'a-matematika', 'b-dizayn', 'b-dasturlash', 'b-pending');
$$;

-- Guests ----------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(pg_temp.feed(), '{}'::text[], 'guests follow nobody: the feed is empty');

-- Reader ----------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000071", "role": "authenticated"}';

select is(pg_temp.feed(), '{}'::text[], 'following nothing: the feed is empty');

insert into public.follows_topics (topic_id) select id from public.topics where slug = 'dasturlash';
select is(pg_temp.feed(), array['a-dasturlash', 'b-dasturlash'], 'a followed topic brings its resources');

insert into public.follows_users (followed_id) values ('00000000-0000-4000-8000-000000000073');
select is(
  pg_temp.feed(),
  array['b-dizayn', 'a-dasturlash', 'b-dasturlash'],
  'a followed author brings theirs too: each card once, newest first, no pending cards'
);

select is(
  (select array_agg(r.slug order by f.n)
   from public.search_resources(following_only => true, page_size => 1,
     after_cursor => (select next_cursor from public.search_resources(following_only => true, page_size => 1)))
     with ordinality as f(id, next_cursor, n)
   join public.resources r on r.id = f.id),
  array['a-dasturlash'],
  'the following feed pages with cursors'
);

select is(
  (select count(*)::integer from public.search_resources(following_only => true, topic_id => (select id from public.topics where slug = 'dizayn'))),
  1,
  'filters combine with the following feed'
);

-- Another user's follows do not leak into the reader's feed, and vice versa.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000072", "role": "authenticated"}';

select is(pg_temp.feed(), '{}'::text[], 'each user sees only their own follows');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000071", "role": "authenticated"}';

delete from public.follows_topics;
delete from public.follows_users;
select is(pg_temp.feed(), '{}'::text[], 'unfollowing removes the cards');

select * from finish();
rollback;
