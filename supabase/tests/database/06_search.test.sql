-- Search, feeds and topic lists: text matching, filters, sorts, pages, visibility.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000061', 'search@test.uz', '{"username": "qidiruvchi"}');

-- Published cards (inserted by trusted server code), one pending and one hidden.
insert into public.resources
  (slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status, published_at, link_status)
values
  ('python-asoslari', '00000000-0000-4000-8000-000000000061', (select id from public.topics where slug = 'dasturlash'),
    'Python asoslari', 'https://example.com/s/python', 'video', 'uz', 'free', 'beginner',
    'Dasturlashni Python tilida noldan oʻrganish: oʻzgaruvchilar, sikllar va funksiyalar.', 'Boshlovchilar uchun',
    'published', now() - interval '5 days', 'ok'),
  ('ozbek-tili-grammatikasi', '00000000-0000-4000-8000-000000000061', (select id from public.topics where slug = 'ingliz-tili'),
    'Oʻzbek tili grammatikasi', 'https://example.com/s/ozbek', 'book', 'uz', 'paid', 'intermediate',
    'Grammatika qoidalari, misollar va mashqlar bilan tushuntirilgan qoʻllanma kitob.', 'Tilni chuqur oʻrganuvchilar',
    'published', now() - interval '4 days', 'ok'),
  ('shaxsiy-moliya', '00000000-0000-4000-8000-000000000061', (select id from public.topics where slug = 'iqtisodiyot-va-moliya'),
    'Shaxsiy moliya asoslari', 'https://example.com/s/moliya', 'course', 'uz', 'freemium', 'all',
    'Byudjet tuzish, jamgʻarma va investitsiyalar haqida amaliy kurs talabalar uchun.', 'Talabalar uchun',
    'published', now() - interval '3 days', 'ok'),
  ('lichnye-finansy', '00000000-0000-4000-8000-000000000061', (select id from public.topics where slug = 'iqtisodiyot-va-moliya'),
    'Личные финансы для студентов', 'https://example.com/s/finansy', 'article', 'ru', 'free', 'beginner',
    'Как вести бюджет, копить и начать инвестировать: понятная статья для студентов.', 'Студентам вузов',
    'published', now() - interval '2 days', 'ok'),
  ('broken-python', '00000000-0000-4000-8000-000000000061', (select id from public.topics where slug = 'dasturlash'),
    'Python masalalari', 'https://example.com/s/broken', 'website', 'en', 'free', 'advanced',
    'Python boʻyicha murakkab masalalar toʻplami, yechimlari bilan birga beriladi.', 'Tajribali dasturchilar',
    'published', now() - interval '1 day', 'broken'),
  ('pending-python', '00000000-0000-4000-8000-000000000061', (select id from public.topics where slug = 'dasturlash'),
    'Python pending', 'https://example.com/s/pending', 'video', 'uz', 'free', 'beginner',
    'Bu karta hali moderator tekshiruvida, shuning uchun roʻyxatlarda koʻrinmasligi kerak.', 'Hech kimga emas',
    'pending', null, 'ok'),
  ('hidden-python', '00000000-0000-4000-8000-000000000061', (select id from public.topics where slug = 'dasturlash'),
    'Python hidden', 'https://example.com/s/hidden', 'video', 'uz', 'free', 'beginner',
    'Bu karta moderator tomonidan yashirilgan, shuning uchun roʻyxatlarda koʻrinmaydi.', 'Hech kimga emas',
    'hidden', now() - interval '6 days', 'ok');

-- Counters, set directly (the interaction triggers are tested elsewhere); the update trigger
-- recomputes popularity_score from them. Popularity: ozbek 1.02 > python 0.54 > moliya 0.18 > finansy 0.
update public.resources set ratings_count = 10, ratings_sum = 45 where slug = 'ozbek-tili-grammatikasi';
update public.resources set ratings_count = 1, ratings_sum = 5 where slug = 'shaxsiy-moliya';
update public.resources set likes_count = 10 where slug = 'python-asoslari';
update public.resources set likes_count = 50 where slug = 'broken-python';

-- Only the cards of this test: other test files may leave none, but be explicit.
create temporary table mine as
  select id from public.resources where author_id = '00000000-0000-4000-8000-000000000061';
grant select on mine to anon, authenticated;

create function pg_temp.slugs(rows_query text)
returns text[]
language plpgsql
as $$
declare
  result text[];
begin
  execute format(
    'select coalesce(array_agg(r.slug order by s.ord), ''{}'') from (select row_number() over () as ord, q.id from (%s) q) s
     join public.resources r on r.id = s.id where s.id in (select id from mine)',
    rows_query
  ) into result;
  return result;
end;
$$;

-- Rating score --------------------------------------------------------------------

select is(
  (select rating_score from public.resources where slug = 'python-asoslari'),
  3::double precision,
  'rating_score is a neutral 3 without ratings'
);
select is(
  (select round(rating_score::numeric, 2) from public.resources where slug = 'shaxsiy-moliya'),
  3.67,
  'one 5-star rating gives 3.67'
);
select is(
  (select round(rating_score::numeric, 2) from public.resources where slug = 'ozbek-tili-grammatikasi'),
  4.25,
  'ten ratings averaging 4.5 give 4.25, above a single 5-star rating'
);

-- Visibility ----------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  pg_temp.slugs('select id from public.search_resources(page_size => 50)'),
  array['broken-python', 'lichnye-finansy', 'shaxsiy-moliya', 'ozbek-tili-grammatikasi', 'python-asoslari'],
  'guests get published cards only, newest first'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000061", "role": "authenticated"}';

select ok(
  not ('pending-python' = any (pg_temp.slugs('select id from public.search_resources(search_text => ''python'', page_size => 50)'))),
  'authors do not see their own pending cards in lists'
);

reset role;
set local request.jwt.claims = '';
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- Text matching -----------------------------------------------------------------------

select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''python'', sort_by => ''newest'')'),
  array['broken-python', 'python-asoslari'],
  'full-text search finds both published Python cards'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''pyth'')'),
  array['broken-python', 'python-asoslari'],
  'prefixes match ("pyth" → Python)'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''dastur'')'),
  array['broken-python', 'python-asoslari'],
  'a stem finds longer Uzbek words ("dastur" → "Dasturlashni", "dasturchilar")'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''o''''zbek'')'),
  array['ozbek-tili-grammatikasi'],
  'apostrophes do not matter (o''zbek → Oʻzbek)'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''ozbek'')'),
  array['ozbek-tili-grammatikasi'],
  'apostrophes do not matter (ozbek → Oʻzbek)'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''PYTHON ASOSLARI'')'),
  array['python-asoslari'],
  'case does not matter and every word must match'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''pyton asoslari'')'),
  array['python-asoslari'],
  'a missing letter still finds the card (trigram)'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''matematka'')'),
  '{}'::text[],
  'unrelated text finds nothing'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''финансы'')'),
  array['lichnye-finansy'],
  'Cyrillic text is searchable'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''шахсий молия'', alt_search_text => ''shaxsiy moliya'')'),
  array['shaxsiy-moliya'],
  'a Cyrillic query finds Latin cards through its transliteration'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => '' !!! '')'),
  array['broken-python', 'lichnye-finansy', 'shaxsiy-moliya', 'ozbek-tili-grammatikasi', 'python-asoslari'],
  'a query with nothing searchable lists everything'
);
select is(
  (pg_temp.slugs('select id from public.search_resources(search_text => ''python asoslari'', sort_by => ''relevance'')'))[1],
  'python-asoslari',
  'relevance puts the best match first'
);

-- Filters --------------------------------------------------------------------------------

select is(
  pg_temp.slugs('select id from public.search_resources(topic_id => (select id from public.topics where slug = ''iqtisodiyot-va-moliya''))'),
  array['lichnye-finansy', 'shaxsiy-moliya'],
  'topic filter'
);
select is(
  pg_temp.slugs('select id from public.search_resources(resource_type => ''book'')'),
  array['ozbek-tili-grammatikasi'],
  'type filter'
);
select is(
  pg_temp.slugs('select id from public.search_resources(resource_language => ''ru'')'),
  array['lichnye-finansy'],
  'language filter'
);
select is(
  pg_temp.slugs('select id from public.search_resources(resource_price => ''free'', resource_level => ''beginner'')'),
  array['lichnye-finansy', 'python-asoslari'],
  'price and level filters combine'
);
select is(
  pg_temp.slugs('select id from public.search_resources(search_text => ''python'', resource_level => ''advanced'')'),
  array['broken-python'],
  'filters combine with text'
);

-- Sorts ------------------------------------------------------------------------------------

select is(
  pg_temp.slugs('select id from public.search_resources(sort_by => ''popular'')'),
  array['ozbek-tili-grammatikasi', 'python-asoslari', 'shaxsiy-moliya', 'lichnye-finansy'],
  'popular: by popularity score, broken links left out'
);
select is(
  pg_temp.slugs('select id from public.search_resources(sort_by => ''top'')'),
  array['ozbek-tili-grammatikasi', 'shaxsiy-moliya', 'broken-python', 'lichnye-finansy', 'python-asoslari'],
  'top: by rating score, then newest'
);
select throws_ok(
  $$select * from public.search_resources(sort_by => 'random')$$,
  '22023', null,
  'unknown sorts are rejected'
);

-- Pages: each row carries the cursor of the page after it --------------------------------------

create temporary table newest_one as
  select * from public.search_resources(sort_by => 'newest', page_size => 2) with ordinality as t(id, next_cursor, n);
select is(
  pg_temp.slugs($$select id from public.search_resources(sort_by => 'newest', page_size => 2,
    after_cursor => (select next_cursor from newest_one order by n desc limit 1))$$),
  array['shaxsiy-moliya', 'ozbek-tili-grammatikasi'],
  'newest: the next page starts after the cursor'
);

create temporary table top_one as
  select * from public.search_resources(sort_by => 'top', page_size => 2) with ordinality as t(id, next_cursor, n);
select is(
  (select next_cursor ->> 'r' from top_one where n = 2),
  '3.6666666666666665',
  'float sort keys travel as exact text'
);
select is(
  pg_temp.slugs($$select id from public.search_resources(sort_by => 'top', page_size => 10,
    after_cursor => (select next_cursor from top_one order by n desc limit 1))$$),
  array['broken-python', 'lichnye-finansy', 'python-asoslari'],
  'top: the next page continues through ties'
);

create temporary table popular_one as
  select * from public.search_resources(sort_by => 'popular', page_size => 2) with ordinality as t(id, next_cursor, n);
select is(
  pg_temp.slugs($$select id from public.search_resources(sort_by => 'popular', page_size => 10,
    after_cursor => (select next_cursor from popular_one order by n desc limit 1))$$),
  array['shaxsiy-moliya', 'lichnye-finansy'],
  'popular: the next page starts after the cursor'
);

create temporary table relevance_one as
  select * from public.search_resources(search_text => 'python', sort_by => 'relevance', page_size => 1)
  with ordinality as t(id, next_cursor, n);
select is(
  pg_temp.slugs($$select id from public.search_resources(search_text => 'python', sort_by => 'relevance', page_size => 1,
    after_cursor => (select next_cursor from relevance_one))$$),
  (pg_temp.slugs($$select id from public.search_resources(search_text => 'python', sort_by => 'relevance')$$))[2:2],
  'relevance pages by offset'
);

select is(
  (select count(*)::integer from public.search_resources(page_size => 1000)),
  5,
  'page size is capped (and all five published cards fit)'
);

select * from finish();
rollback;
