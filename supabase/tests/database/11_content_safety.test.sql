-- Content safety: user texts reach the database only with a safety ticket from the app server.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- N = new member, T = trusted author, M = moderator, O = another member.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000b1', 'sn@test.uz', '{"username": "safe_new"}'),
  ('00000000-0000-4000-8000-0000000000b2', 'st@test.uz', '{"username": "safe_trusted"}'),
  ('00000000-0000-4000-8000-0000000000b3', 'sm@test.uz', '{"username": "safe_mod"}'),
  ('00000000-0000-4000-8000-0000000000b4', 'so@test.uz', '{"username": "safe_other"}');
update public.profiles set created_at = now() - interval '10 days'
  where id in ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b4');
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-0000000000b3';

-- T has three published cards (trusted); one of them is commented on below.
insert into public.resources (id, slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status)
select ('00000000-0000-4000-8000-00000000c00' || n)::uuid, 'safe-' || n, '00000000-0000-4000-8000-0000000000b2',
  (select id from public.topics where slug = 'dasturlash'), 'Xavfsiz karta ' || n, 'https://example.com/safe/' || n,
  'website', 'uz', 'free', 'all', 'Xavfsizlik tekshiruvi testlari uchun yozilgan yetarlicha uzun matn.',
  'Testlar uchun yozilgan', 'published'
from generate_series(1, 3) as n;
insert into public.blocked_domains (domain, reason) values ('phishing.example', 'test');

-- What the app server does after its checks (as the service role).
create function pg_temp.ticket(for_user uuid, kind text, decision text, final_url text, variadic parts text[])
returns void
language sql
security definer
set search_path = ''
as $$ select public.issue_safety_ticket(for_user, kind, private.content_hash(variadic parts), decision, final_url, 'safe'); $$;

create function pg_temp.new_card(slug text, title text)
returns void
language sql
as $$
  insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom)
  values (slug, (select id from public.topics where slug = 'matematika'), title, 'https://example.org/' || slug,
    'website', 'uz', 'free', 'all', 'Xavfsizlik tekshiruvi testlari uchun yozilgan yetarlicha uzun matn.',
    'Testlar uchun yozilgan');
$$;

create function pg_temp.card_ticket(for_user uuid, slug text, title text, decision text default 'allow',
  final_url text default null)
returns void
language sql
as $$
  select pg_temp.ticket(for_user, 'resource', decision, final_url, 'https://example.org/' || slug, title,
    'Xavfsizlik tekshiruvi testlari uchun yozilgan yetarlicha uzun matn.', 'Testlar uchun yozilgan', '');
$$;

-- Resources -------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}';

select throws_ok($$select pg_temp.new_card('n-1', 'Tekshirilmagan karta')$$, 'P0001', 'unchecked_submission',
  'a card written straight to the Data API, without the server''s check, is refused');
select throws_ok($$select public.issue_safety_ticket('00000000-0000-4000-8000-0000000000b1', 'resource', 'x', 'allow')$$,
  '42501', null, 'users cannot issue tickets to themselves');

select pg_temp.card_ticket('00000000-0000-4000-8000-0000000000b1', 'n-1', 'Tekshirilgan karta');
select throws_ok($$select pg_temp.new_card('n-1', 'Boshqa sarlavha')$$, 'P0001', 'unchecked_submission',
  'a ticket covers exactly the checked text, not an edited one');
select lives_ok($$select pg_temp.new_card('n-1', 'Tekshirilgan karta')$$, 'with the ticket the card is accepted');
select is((select status::text from public.resources where slug = 'n-1'), 'pending', 'a new member''s card still waits for review');

select throws_ok($$delete from public.resources where slug = 'n-1'; select pg_temp.new_card('n-1', 'Tekshirilgan karta')$$,
  'P0001', 'unchecked_submission', 'a ticket is used up by one write');

-- Someone else's ticket is useless.
select pg_temp.card_ticket('00000000-0000-4000-8000-0000000000b4', 'n-2', 'Begona chipta');
select throws_ok($$select pg_temp.new_card('n-2', 'Begona chipta')$$, 'P0001', 'unchecked_submission',
  'a ticket issued for another user cannot be used');

-- Old tickets expire.
reset role;
select pg_temp.card_ticket('00000000-0000-4000-8000-0000000000b1', 'n-3', 'Eski chipta');
update private.safety_tickets set created_at = now() - interval '16 minutes' where user_id = '00000000-0000-4000-8000-0000000000b1';
set local role authenticated;
select throws_ok($$select pg_temp.new_card('n-3', 'Eski chipta')$$, 'P0001', 'unchecked_submission',
  'a ticket older than 15 minutes has expired');

-- A trusted author's card that the check holds back waits for review too.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}';
select pg_temp.card_ticket('00000000-0000-4000-8000-0000000000b2', 't-1', 'Shubhali karta', 'needs_review',
  'https://example.org/t-1-final');
select pg_temp.new_card('t-1', 'Shubhali karta');
select is((select status::text from public.resources where slug = 't-1'), 'pending',
  '"needs review" keeps even a trusted author''s card for a moderator');
select is((select final_url || ' ' || reputation_status from public.resources where slug = 't-1'),
  'https://example.org/t-1-final safe', 'where the link leads and its reputation come from the ticket');

select pg_temp.card_ticket('00000000-0000-4000-8000-0000000000b2', 't-2', 'Ishonchli karta');
select pg_temp.new_card('t-2', 'Ishonchli karta');
select is((select status::text from public.resources where slug = 't-2'), 'published', 'an allowed card of a trusted author is published');

select throws_ok(
  $$insert into public.resources (slug, topic_id, title, url, type, language, price, level, summary, for_whom, final_url)
    values ('t-3', (select id from public.topics where slug = 'matematika'), 'Soxta manzil', 'https://example.org/t-3',
      'website', 'uz', 'free', 'all', 'Xavfsizlik tekshiruvi testlari uchun yozilgan yetarlicha uzun matn.',
      'Testlar uchun yozilgan', 'https://example.org/anywhere')$$,
  '42501', null, 'users cannot set where their link leads themselves');

select pg_temp.card_ticket('00000000-0000-4000-8000-0000000000b2', 't-4', 'Yoʻnaltiruvchi karta', 'allow',
  'https://login.phishing.example/steal');
select throws_ok($$select pg_temp.new_card('t-4', 'Yoʻnaltiruvchi karta')$$, 'P0001', 'blocked_domain',
  'a link that leads to a blocked domain is refused');

-- Edits: text changes need a new ticket, other fields do not.
select lives_ok($$update public.resources set level = 'beginner' where slug = 't-2'$$, 'changing the level needs no ticket');
select throws_ok($$update public.resources set title = 'Yangi sarlavha' where slug = 't-2'$$, 'P0001', 'unchecked_submission',
  'changing a text needs a ticket');

-- Comments --------------------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}';

select throws_ok(
  $$insert into public.comments (resource_id, body) values ('00000000-0000-4000-8000-00000000c001', 'Tekshirilmagan izoh')$$,
  'P0001', 'unchecked_submission', 'an unchecked comment is refused');

select pg_temp.ticket('00000000-0000-4000-8000-0000000000b1', 'comment', 'needs_review', null,
  '00000000-0000-4000-8000-00000000c001', 'Batafsil: https://example.net/sahifa');
insert into public.comments (resource_id, body) values ('00000000-0000-4000-8000-00000000c001', 'Batafsil: https://example.net/sahifa');
select is((select status::text from public.comments where body like 'Batafsil%'), 'pending',
  'a held comment waits for review');
select is((select comments_count from public.resources where id = '00000000-0000-4000-8000-00000000c001'), 0,
  'and is not counted');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b4", "role": "authenticated"}';
select is_empty($$select 1 from public.comments where body like 'Batafsil%'$$, 'other members do not see it');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b3", "role": "authenticated"}';
update public.comments set status = 'published' where body like 'Batafsil%';
select is((select comments_count from public.resources where id = '00000000-0000-4000-8000-00000000c001'), 1,
  'a moderator publishes it and it is counted');

-- Ratings ---------------------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b4", "role": "authenticated"}';

select lives_ok(
  $$insert into public.resource_ratings (resource_id, stars) values ('00000000-0000-4000-8000-00000000c001', 4)$$,
  'stars alone need no ticket');
select throws_ok(
  $$update public.resource_ratings set review_text = 'Tekshirilmagan sharh' where resource_id = '00000000-0000-4000-8000-00000000c001'$$,
  'P0001', 'unchecked_submission', 'a review text needs a ticket');
select pg_temp.ticket('00000000-0000-4000-8000-0000000000b4', 'rating', 'needs_review', null,
  '00000000-0000-4000-8000-00000000c001', 'Shubhali sharh');
select throws_ok(
  $$update public.resource_ratings set review_text = 'Shubhali sharh' where resource_id = '00000000-0000-4000-8000-00000000c001'$$,
  'P0001', 'unchecked_submission', 'reviews have no queue: only allowed texts are saved');

-- Profiles --------------------------------------------------------------------------------------

select throws_ok($$update public.profiles set bio = 'Tekshirilmagan bio' where id = '00000000-0000-4000-8000-0000000000b4'$$,
  'P0001', 'unchecked_submission', 'profile texts need a ticket');
select pg_temp.ticket('00000000-0000-4000-8000-0000000000b4', 'profile', 'allow', null,
  'safe_other', 'safe_other', 'Tekshirilgan bio', '', '');
select lives_ok($$update public.profiles set bio = 'Tekshirilgan bio' where id = '00000000-0000-4000-8000-0000000000b4'$$,
  'with a ticket the bio is saved');
select hasnt_column('public', 'profiles', 'avatar_url', 'profiles have no photo any more');

-- Trust levels and the internal tables ------------------------------------------------------------

select is(public.my_trust_level(), 0, 'an old account without published cards is level 0');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}';
select is(public.my_trust_level(), 1, 'a trusted author is level 1');
select is_empty($$select 1 from public.moderation_events$$, 'members cannot read moderation events');

reset role;
insert into public.moderation_events (user_id, target_type, decision, reasons, excerpt)
values ('00000000-0000-4000-8000-0000000000b1', 'resource', 'reject', array['text.scam:summary'], 'Tez boyib keting');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b3", "role": "authenticated"}';
select is((select reasons from public.moderation_events), array['text.scam:summary'], 'staff read why something was refused');

select * from finish();
rollback;
