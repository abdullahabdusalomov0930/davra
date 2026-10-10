-- Resources: trust-based status, visibility, who may edit what, blocked domains, search columns.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- These tests are not about the content safety check (11_content_safety.test.sql is). The app server
-- checks every text before it is written and issues a single-use ticket for it; these triggers stand
-- in for the server and issue that ticket for every write. They are rolled back with the test.
create function pg_temp.vouch(kind text, content_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.issue_safety_ticket((select auth.uid()), kind, content_hash, 'allow') where (select auth.uid()) is not null;
$$;

create function pg_temp.vouch_resource() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_temp.vouch('resource',
    private.content_hash(new.url, new.title, new.summary, new.for_whom, coalesce(new.author_review, '')));
  return new;
end $$;
create function pg_temp.vouch_comment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_temp.vouch('comment', private.content_hash(new.resource_id::text, new.body));
  return new;
end $$;
create function pg_temp.vouch_rating() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.review_text is not null then
    perform pg_temp.vouch('rating', private.content_hash(new.resource_id::text, new.review_text));
  end if;
  return new;
end $$;
create function pg_temp.vouch_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_temp.vouch('profile', private.content_hash(new.username, new.display_name,
    coalesce(new.bio, ''), coalesce(new.university, ''), coalesce(new.field_of_study, '')));
  return new;
end $$;

-- "aaa_" runs before the other BEFORE triggers.
create trigger aaa_vouch before insert or update on public.resources
  for each row execute function pg_temp.vouch_resource();
create trigger aaa_vouch before insert on public.comments
  for each row execute function pg_temp.vouch_comment();
create trigger aaa_vouch before insert or update on public.resource_ratings
  for each row execute function pg_temp.vouch_rating();
create trigger aaa_vouch before update on public.profiles
  for each row execute function pg_temp.vouch_profile();

-- N = new user, V = veteran (trusted), M = moderator, O = other established user.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000011', 'n@test.uz', '{"username": "newbie"}'),
  ('00000000-0000-4000-8000-000000000012', 'v@test.uz', '{"username": "veteran"}'),
  ('00000000-0000-4000-8000-000000000013', 'm@test.uz', '{"username": "moder"}'),
  ('00000000-0000-4000-8000-000000000014', 'o@test.uz', '{"username": "other"}');
update public.profiles set created_at = now() - interval '10 days'
  where id in ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000014');
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000013';

-- Trusted server code (this session is `postgres`) may insert published resources directly.
insert into public.resources (slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status)
select 'veteran-' || n, '00000000-0000-4000-8000-000000000012', (select id from public.topics where slug = 'dasturlash'),
  'Veteran resursi ' || n, 'https://example.com/veteran/' || n, 'course', 'uz', 'free', 'beginner',
  'Bu resurs dasturlash asoslarini qadamma-qadam tushuntirib beradi.', 'Boshlovchi talabalar uchun', 'published'
from generate_series(1, 3) as n;

select ok(private.is_trusted_author('00000000-0000-4000-8000-000000000012'), 'an old account with 3 published resources is trusted');
select ok(not private.is_trusted_author('00000000-0000-4000-8000-000000000011'), 'a new account is not trusted');
select ok(not private.is_trusted_author('00000000-0000-4000-8000-000000000014'), 'an old account without published resources is not trusted');
select ok(private.is_trusted_author('00000000-0000-4000-8000-000000000013'), 'staff are trusted');

-- New user creates a resource -----------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000011", "role": "authenticated"}';

select lives_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
    values ('khan-academy-matematika', (select id from public.topics where slug = 'matematika'),
      'Khan Academy: matematika', 'https://www.khanacademy.org/math', 'course', 'en', 'free', 'all',
      'Arifmetikadan matematik analizgacha boʻlgan bepul video darslar va mashqlar.',
      'Maktab va universitet talabalari uchun')$$,
  'a new user can create a resource'
);

select results_eq(
  $$select status::text, published_at is null, domain, author_id::text, link_status::text
    from public.resources where slug = 'khan-academy-matematika'$$,
  $$values ('pending', true, 'khanacademy.org', '00000000-0000-4000-8000-000000000011', 'unknown')$$,
  'a new user''s resource waits in the queue; author and domain come from the database'
);

select throws_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom, status)
    values ('x-status', (select id from public.topics limit 1), 'Oʻz-oʻzini nashr qilish', 'https://example.org/a',
      'website', 'uz', 'free', 'all', 'Bu yerda status maydonini qoʻlda yuborishga urinib koʻramiz, bu taqiqlangan.',
      'Hech kim uchun emas', 'published')$$,
  '42501', null,
  'clients cannot choose the status'
);

select throws_ok(
  $$insert into public.resources (slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom)
    values ('x-author', '00000000-0000-4000-8000-000000000012', (select id from public.topics limit 1), 'Begona nomidan',
      'https://example.org/b', 'website', 'uz', 'free', 'all',
      'Bu yerda boshqa foydalanuvchi nomidan resurs qoʻshishga urinib koʻramiz.', 'Hech kim uchun emas')$$,
  '42501', null,
  'clients cannot post in someone else''s name'
);

select throws_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
    values ('qisqa-havola', (select id from public.topics limit 1), 'Qisqartirilgan havola', 'https://bit.ly/3abcdef',
      'website', 'uz', 'free', 'all', 'Qisqartirilgan havolalar haqiqiy manzilni yashiradi, shuning uchun taqiqlangan.',
      'Hech kim uchun emas')$$,
  'P0001', 'blocked_domain',
  'links to blocked domains (URL shorteners) are rejected'
);

select throws_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
    values ('qisqa-havola-2', (select id from public.topics limit 1), 'Qisqartirilgan havola', 'https://go.bit.ly/x',
      'website', 'uz', 'free', 'all', 'Bloklangan domenning subdomenlari ham bloklangan boʻlishi kerak, albatta.',
      'Hech kim uchun emas')$$,
  'P0001', 'blocked_domain',
  'subdomains of blocked domains are rejected too'
);

select lives_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
    values ('notbit-ly', (select id from public.topics limit 1), 'Oʻxshash nomli sayt', 'https://notbit.ly/page',
      'website', 'uz', 'free', 'all', 'Nomi bloklangan domenga oʻxshash, lekin boshqa domen boʻlgan sayt.',
      'Tekshiruv uchun')$$,
  'a domain that merely ends with the same letters is not blocked'
);

select throws_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
    values ('dublikat', (select id from public.topics limit 1), 'Dublikat havola', 'https://example.com/veteran/1',
      'website', 'uz', 'free', 'all', 'Bu havola allaqachon boshqa foydalanuvchi tomonidan qoʻshilgan edi.',
      'Tekshiruv uchun')$$,
  '23505', null,
  'the same URL cannot be added twice'
);

select throws_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
    values ('ftp-havola', (select id from public.topics limit 1), 'FTP havola', 'ftp://example.com/file',
      'website', 'uz', 'free', 'all', 'Faqat http va https havolalari qabul qilinadi, boshqa protokollar yoʻq.',
      'Tekshiruv uchun')$$,
  '23514', null,
  'only http(s) URLs are accepted'
);

select throws_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
    values ('qisqa-tavsif', (select id from public.topics limit 1), 'Qisqa tavsif', 'https://example.com/short',
      'website', 'uz', 'free', 'all', 'Juda qisqa.', 'Tekshiruv uchun')$$,
  '23514', null,
  'summaries shorter than 40 characters are rejected'
);

-- Visibility of the pending resource ----------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty(
  $$select 1 from public.resources where slug = 'khan-academy-matematika'$$,
  'guests do not see pending resources'
);

select is(
  (select count(*)::integer from public.resources where slug like 'veteran-%'),
  3,
  'guests see published resources'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000014", "role": "authenticated"}';

select is_empty(
  $$select 1 from public.resources where slug = 'khan-academy-matematika'$$,
  'other users do not see pending resources'
);

update public.resources set title = 'Buzilgan sarlavha' where slug = 'khan-academy-matematika';
update public.resources set title = 'Buzilgan sarlavha' where slug = 'veteran-1';

select is(
  (select title from public.resources where slug = 'veteran-1'),
  'Veteran resursi 1',
  'users cannot edit other users'' resources (RLS filters the row out)'
);

-- Author edits ----------------------------------------------------------------------

reset role;
set local request.jwt.claims = '';
update public.resources set created_at = now() - interval '1 day', updated_at = now() - interval '1 day'
  where slug = 'khan-academy-matematika';

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000011", "role": "authenticated"}';

select lives_ok(
  $$update public.resources set title = 'Khan Academy — matematika' where slug = 'khan-academy-matematika'$$,
  'authors can edit their resources'
);

select ok(
  (select updated_at > created_at from public.resources where slug = 'khan-academy-matematika'),
  'editing the content updates updated_at'
);

select throws_ok(
  $$update public.resources set status = 'published' where slug = 'khan-academy-matematika'$$,
  '42501', null,
  'authors cannot publish their own resource'
);

select throws_ok(
  $$update public.resources set likes_count = 1000 where slug = 'khan-academy-matematika'$$,
  '42501', null,
  'authors cannot touch the counters'
);

select throws_ok(
  $$update public.resources set slug = 'yangi-slug' where slug = 'khan-academy-matematika'$$,
  '42501', null,
  'slugs never change'
);

-- Moderator -------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000013", "role": "authenticated"}';

select is(
  (select status::text from public.resources where slug = 'khan-academy-matematika'),
  'pending',
  'moderators see the pending queue'
);

select lives_ok(
  $$update public.resources set status = 'published' where slug = 'khan-academy-matematika'$$,
  'moderators can publish a pending resource'
);

select results_eq(
  $$select r.status::text, r.published_at is not null, a.action, a.details ->> 'from', a.details ->> 'to'
    from public.resources r join public.audit_log a on a.target_id = r.id::text
    where r.slug = 'khan-academy-matematika'$$,
  $$values ('published', true, 'resource.status', 'pending', 'published')$$,
  'publishing sets published_at and is audited'
);

select throws_ok(
  $$update public.resources set title = 'Moderator tahriri' where slug = 'khan-academy-matematika'$$,
  '42501', null,
  'moderators cannot rewrite someone else''s card'
);

delete from public.resources where slug = 'khan-academy-matematika';

select isnt_empty(
  $$select 1 from public.resources where slug = 'khan-academy-matematika'$$,
  'moderators cannot delete other users'' resources (they hide them instead)'
);

-- Changing the URL --------------------------------------------------------------------

reset role;
set local request.jwt.claims = '';
update public.resources set link_status = 'ok', link_check_failures = 1, last_link_check_at = now()
  where slug in ('khan-academy-matematika', 'veteran-1');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000011", "role": "authenticated"}';

update public.resources set url = 'https://www.khanacademy.org/math/algebra' where slug = 'khan-academy-matematika';

select results_eq(
  $$select status::text, link_status::text, link_check_failures, last_link_check_at is null, domain
    from public.resources where slug = 'khan-academy-matematika'$$,
  $$values ('pending', 'unknown', 0::smallint, true, 'khanacademy.org')$$,
  'a new URL from an untrusted author goes back to the queue and is checked again'
);

select throws_ok(
  $$update public.resources set url = 'https://bit.ly/zzz' where slug = 'khan-academy-matematika'$$,
  'P0001', 'blocked_domain',
  'a URL cannot be changed to a blocked domain'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000012", "role": "authenticated"}';

update public.resources set url = 'https://example.com/veteran/1-new' where slug = 'veteran-1';

select results_eq(
  $$select status::text, link_status::text from public.resources where slug = 'veteran-1'$$,
  $$values ('published', 'unknown')$$,
  'a trusted author''s new URL stays published but is checked again'
);

-- Search columns --------------------------------------------------------------------------

reset role;
set local request.jwt.claims = '';
update public.resources set title = 'Oʻzbek tili grammatikasi' where slug = 'veteran-2';

select ok(
  (select search_vector @@ to_tsquery('simple', private.normalize_search_text('o''zbek'))
   from public.resources where slug = 'veteran-2'),
  'full-text search ignores apostrophe variants (oʻzbek = o''zbek = ozbek)'
);

select ok(
  (select extensions.similarity(private.normalize_search_text(title), private.normalize_search_text('ozbek tli')) > 0.3
   from public.resources where slug = 'veteran-2'),
  'trigram similarity tolerates typos'
);

-- Banned author ------------------------------------------------------------------------------

update public.profiles set is_banned = true where id = '00000000-0000-4000-8000-000000000012';

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000012", "role": "authenticated"}';

update public.resources set title = 'Bloklangandan keyin' where slug = 'veteran-3';
delete from public.resources where slug = 'veteran-3';

select is(
  (select title from public.resources where slug = 'veteran-3'),
  'Veteran resursi 3',
  'banned users can neither edit nor delete their resources'
);

select throws_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
    values ('bloklangan', (select id from public.topics limit 1), 'Bloklangan muallif', 'https://example.com/banned',
      'website', 'uz', 'free', 'all', 'Bloklangan foydalanuvchi yangi resurs qoʻsha olmasligi kerak, albatta.',
      'Tekshiruv uchun')$$,
  '42501', null,
  'banned users cannot create resources'
);

select ok(not private.is_trusted_author('00000000-0000-4000-8000-000000000012'), 'banned users are not trusted');

-- Deleting -----------------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000011", "role": "authenticated"}';

select lives_ok(
  $$delete from public.resources where slug = 'khan-academy-matematika'$$,
  'authors can delete their resources'
);

reset role;
set local request.jwt.claims = '';

select is_empty(
  $$select 1 from public.resources where slug = 'khan-academy-matematika'$$,
  'the deleted resource is gone'
);

select * from finish();
rollback;
