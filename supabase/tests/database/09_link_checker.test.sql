-- Link checker results: two failures in a row mark a link broken; 403/429 ("unknown") change nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000091', 'links@test.uz', '{"username": "havola_muallifi"}');

insert into public.resources
  (id, slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status)
values
  ('00000000-0000-4000-8000-000000000092', 'link-check', '00000000-0000-4000-8000-000000000091',
    (select id from public.topics where slug = 'dasturlash'), 'Havola tekshiruvi', 'https://example.com/check',
    'website', 'uz', 'free', 'all',
    'Havolalarni tekshirish jarayonini sinash uchun yaratilgan resurs matni.', 'Testlar uchun yozilgan', 'published');

create function pg_temp.state()
returns text
language sql
as $$
  select link_status || '/' || link_check_failures || '/' || (last_link_check_at is not null)
  from public.resources where id = '00000000-0000-4000-8000-000000000092';
$$;

create function pg_temp.check_link(outcome text, url text default 'https://example.com/check')
returns text
language sql
as $$ select public.record_link_check('00000000-0000-4000-8000-000000000092', url, outcome)::text; $$;

-- Who may record results ------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000091", "role": "authenticated"}';
select throws_ok($$select pg_temp.check_link('ok')$$, '42501', null, 'users cannot record link checks, not even the author');

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$select pg_temp.check_link('ok')$$, '42501', null, 'guests cannot record link checks');

reset role;
set local request.jwt.claims = '';
set local role service_role;

-- Outcomes -----------------------------------------------------------------------------------

select is(pg_temp.check_link('failure'), 'unknown', 'one failure is not enough to call a link broken');
select is(pg_temp.state(), 'unknown/1/true', 'the failure is counted and the check time stored');
select is(pg_temp.check_link('unknown'), 'unknown', 'a 403/429 answer changes nothing…');
select is(pg_temp.state(), 'unknown/1/true', '…not even the failure count');
select is(pg_temp.check_link('failure'), 'broken', 'the second failure in a row marks the link broken');
select is(pg_temp.check_link('ok'), 'ok', 'a working link is ok again');
select is(pg_temp.state(), 'ok/0/true', 'and the failure count starts over');

select is(
  pg_temp.check_link('failure', 'https://example.com/old-link'),
  null,
  'a result for a link the author has since changed is ignored'
);

select throws_ok($$select pg_temp.check_link('maybe')$$, '22023', null, 'unknown outcomes are rejected');

select * from finish();
rollback;
