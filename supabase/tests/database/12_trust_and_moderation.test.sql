-- Trust levels, bans, weighted reports and auto-hide, severe incidents, appeals, moderation reasons,
-- two-step actions and the admin-only tables.
begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

-- n new member, b basic author (1 card), t trusted author (3 cards), r2/r3 reporters (levels 1 and 2),
-- m moderator, a admin.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000d1', 'tn@test.uz', '{"username": "tm_new"}'),
  ('00000000-0000-4000-8000-0000000000d2', 'tb@test.uz', '{"username": "tm_basic"}'),
  ('00000000-0000-4000-8000-0000000000d3', 'tt@test.uz', '{"username": "tm_trusted"}'),
  ('00000000-0000-4000-8000-0000000000d4', 'tr2@test.uz', '{"username": "tm_rep_two"}'),
  ('00000000-0000-4000-8000-0000000000d5', 'tr3@test.uz', '{"username": "tm_rep_three"}'),
  ('00000000-0000-4000-8000-0000000000d6', 'tm@test.uz', '{"username": "tm_mod"}'),
  ('00000000-0000-4000-8000-0000000000d7', 'ta@test.uz', '{"username": "tm_admin"}');
update public.profiles set created_at = now() - interval '10 days'
  where id in ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d3',
    '00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000d5');
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-0000000000d6';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000000d7';

create function pg_temp.card(slug text, author uuid, status public.resource_status default 'published')
returns uuid
language sql
as $$
  insert into public.resources (slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status)
  values (slug, author, (select id from public.topics where slug = 'dasturlash'), 'Karta ' || slug,
    'https://example.com/tm/' || slug, 'website', 'uz', 'free', 'all',
    'Ishonch darajalari va moderatsiya testlari uchun yetarlicha uzun matn.', 'Testlar uchun yozilgan', status)
  returning id;
$$;

select pg_temp.card('tm-b1', '00000000-0000-4000-8000-0000000000d2');
select pg_temp.card('tm-t' || n, '00000000-0000-4000-8000-0000000000d3') from generate_series(1, 3) as n;
select pg_temp.card('tm-r2', '00000000-0000-4000-8000-0000000000d4');
select pg_temp.card('tm-r3-' || n, '00000000-0000-4000-8000-0000000000d5') from generate_series(1, 3) as n;

create function pg_temp.level(user_id uuid) returns smallint language sql as $$
  select trust_level from public.profiles where id = user_id;
$$;

create function pg_temp.act_as(user_id text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
    set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Trust levels ------------------------------------------------------------------------------------

select is(pg_temp.level('00000000-0000-4000-8000-0000000000d1'), 0::smallint, 'a new account is level 0');
select is(pg_temp.level('00000000-0000-4000-8000-0000000000d2'), 1::smallint, 'one published card makes level 1');
select is(pg_temp.level('00000000-0000-4000-8000-0000000000d3'), 2::smallint, 'three published cards make level 2');
select is(pg_temp.level('00000000-0000-4000-8000-0000000000d6'), 3::smallint, 'moderators are level 3');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
select throws_ok($$update public.profiles set trust_level = 3 where id = '00000000-0000-4000-8000-0000000000d1'$$,
  '42501', null, 'users cannot raise their own trust level');
reset role;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d6');
select throws_ok($$select public.set_trust_level('00000000-0000-4000-8000-0000000000d1', 2, 'Ishonchli')$$,
  '42501', null, 'moderators cannot set trust levels');
reset role;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d7');
select lives_ok($$select public.set_trust_level('00000000-0000-4000-8000-0000000000d1', 1, 'Tanish oʻqituvchi')$$,
  'admins set a trust level by hand');
reset role;
select is((select (trust_level, trust_level_manual)::text from public.profiles where id = '00000000-0000-4000-8000-0000000000d1'),
  '(1,t)', 'a level set by hand is kept as manual');
select private.refresh_all_trust_levels();
select is(pg_temp.level('00000000-0000-4000-8000-0000000000d1'), 1::smallint, 'the automatic rules leave a manual level alone');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d7');
select public.set_trust_level('00000000-0000-4000-8000-0000000000d1', null, 'Avtomatik qoidalarga qaytarildi');
reset role;
select is(pg_temp.level('00000000-0000-4000-8000-0000000000d1'), 0::smallint, 'handing it back recomputes the level');

-- Reasons ---------------------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d6');
select throws_ok($$select public.moderate_resource((select id from public.resources where slug = 'tm-t1'), 'hidden', '')$$,
  'P0001', 'reason_required', 'a moderation action without a reason is refused');
select throws_ok($$select set_config('davra.reason', '', true);
  update public.resources set status = 'hidden' where slug = 'tm-t1'$$,
  'P0001', 'reason_required', 'a direct status change by staff needs a reason too');
select lives_ok($$select public.moderate_resource((select id from public.resources where slug = 'tm-t1'), 'hidden', 'Reklama', 'spam')$$,
  'with a reason the moderator hides a card');
reset role;
select is((select reason || ' ' || action from public.audit_log where target_id = (select id::text from public.resources where slug = 'tm-t1')),
  'Reklama resource.status', 'the audit log keeps the reason');
select is((select rule || ' ' || message from public.notifications
  where user_id = '00000000-0000-4000-8000-0000000000d3' and kind = 'content_hidden'),
  'spam Reklama', 'the author is notified with the rule and the reason');

-- Weighted reports and auto-hide ------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
insert into public.reports (target_type, target_id, reason) values ('resource', (select id from public.resources where slug = 'tm-t2'), 'spam');
reset role;
select is((select weight from public.reports where reporter_id = '00000000-0000-4000-8000-0000000000d1'), 0.25::numeric(4,2),
  'a brand-new account''s report counts a quarter');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d4');
insert into public.reports (target_type, target_id, reason) values ('resource', (select id from public.resources where slug = 'tm-t2'), 'spam');
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
insert into public.reports (target_type, target_id, reason) values ('resource', (select id from public.resources where slug = 'tm-t2'), 'spam');
reset role;
select is((select status::text from public.resources where slug = 'tm-t2'), 'published',
  'reports weighing 2.25 do not hide a card');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d5');
insert into public.reports (target_type, target_id, reason) values ('resource', (select id from public.resources where slug = 'tm-t2'), 'wrong_info');
reset role;
select is((select status || ' ' || moderation_state from public.resources where slug = 'tm-t2'), 'hidden auto_hidden',
  'reaching the threshold (3) hides the card automatically');
select is((select rule from public.notifications where target_id = (select id from public.resources where slug = 'tm-t2')),
  'spam', 'the notice names the rule most reports gave');
select is((select action from public.audit_log where target_id = (select id::text from public.resources where slug = 'tm-t2')),
  'resource.auto_hide', 'automatic hiding is in the audit log');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d4');
insert into public.reports (target_type, target_id, reason) values ('resource', (select id from public.resources where slug = 'tm-t3'), 'scam_phishing');
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
insert into public.reports (target_type, target_id, reason) values ('resource', (select id from public.resources where slug = 'tm-t3'), 'illegal');
reset role;
select is((select status::text from public.resources where slug = 'tm-t3'), 'hidden',
  'scam and illegal reports hide at the lower threshold (2)');

-- Dismissing the reports gives an automatically hidden card back.
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d6');
select lives_ok($$select public.handle_reports('resource', (select id from public.resources where slug = 'tm-t2'), 'dismiss',
  'Qoidabuzarlik topilmadi')$$, 'moderators dismiss reports with a reason');
reset role;
select is((select status::text || coalesce(moderation_state, '') from public.resources where slug = 'tm-t2'), 'published',
  'dismissing the reports restores the card');
select is((select count(*)::int from public.reports where target_id = (select id from public.resources where slug = 'tm-t2') and status = 'dismissed'),
  4, 'every report about the card is closed');

-- Severe content ----------------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d1');
insert into public.reports (target_type, target_id, reason, details)
  values ('resource', (select id from public.resources where slug = 'tm-r2'), 'severe', 'Tahdid');
reset role;
select is((select status || ' ' || moderation_state from public.resources where slug = 'tm-r2'), 'hidden severe',
  'one severe report hides the card at once');
select is((select snapshot ->> 'title' from public.severe_incidents), 'Karta tm-r2',
  'a frozen copy of the content is kept');
select is((select reports -> 0 ->> 'details' from public.severe_incidents), 'Tahdid', 'with the report details');
select is((select message from public.notifications where target_id = (select id from public.resources where slug = 'tm-r2')),
  null, 'the author is not told why');

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d6');
select is_empty($$select 1 from public.severe_incidents$$, 'moderators cannot read severe incidents');
select throws_ok($$select public.handle_reports('resource', (select id from public.resources where slug = 'tm-r2'), 'dismiss', 'Notoʻgʻri shikoyat')$$,
  '42501', null, 'only admins dismiss a severe report');
reset role;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d7');
select isnt_empty($$select 1 from public.severe_incidents$$, 'admins read severe incidents');
select throws_ok($$select public.delete_content('resource', (select id from public.resources where slug = 'tm-r2'), 'Dalillar saqlandi')$$,
  'P0001', 'evidence_not_preserved', 'content cannot be deleted before the evidence is marked preserved');
update public.severe_incidents set status = 'preserved';
select lives_ok($$select public.delete_content('resource', (select id from public.resources where slug = 'tm-r2'), 'Dalillar saqlandi')$$,
  'after that an admin deletes it');
reset role;
select is((select count(*)::int from public.severe_incidents), 1, 'the evidence outlives the content');

-- Bans --------------------------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d6');
select throws_ok($$select public.set_user_ban('00000000-0000-4000-8000-0000000000d5', null, 'Spam')$$,
  '42501', null, 'moderators cannot ban permanently');
select lives_ok($$select public.set_user_ban('00000000-0000-4000-8000-0000000000d5', 7, 'Takroriy spam', 'spam')$$,
  'moderators ban for 7 days');
select is((select count(*)::int from public.resources where author_id = '00000000-0000-4000-8000-0000000000d5' and status = 'published'),
  0, 'the banned user''s cards are hidden');
select throws_ok($$select ban_reason from public.profiles where id = '00000000-0000-4000-8000-0000000000d5'$$,
  '42501', null, 'the ban reason is not a public column');
reset role;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d5');
select is((select ban_reason from public.ban_details('00000000-0000-4000-8000-0000000000d5')), 'Takroriy spam',
  'the banned user can read why');
select throws_ok($$insert into public.reports (target_type, target_id, reason)
  values ('resource', (select id from public.resources where slug = 'tm-b1'), 'spam')$$,
  '42501', null, 'banned users cannot report');
select is((select kind from public.notifications order by created_at desc limit 1), 'banned', 'and were told about the ban');

-- Appeals -----------------------------------------------------------------------------------------

select lives_ok($$insert into public.appeals (target_type, target_id, message)
  values ('ban', '00000000-0000-4000-8000-0000000000d5', 'Men spam qilmadim, iltimos qayta koʻrib chiqing.')$$,
  'a banned user can appeal the ban');
select throws_ok($$insert into public.appeals (target_type, target_id, message)
  values ('ban', '00000000-0000-4000-8000-0000000000d5', 'Yana bir bor soʻrayman, iltimos.')$$,
  '23505', null, 'once');
reset role;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d2');
select throws_ok($$insert into public.appeals (target_type, target_id, message)
  values ('resource', (select id from public.resources where slug = 'tm-b1'), 'Bu karta yashirilmagan-ku.')$$,
  '23503', null, 'only hidden content can be appealed');
reset role;

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d6');
select lives_ok($$select public.handle_appeal((select id from public.appeals), true, 'Tekshirdik, ban bekor qilindi')$$,
  'a moderator accepts the appeal');
reset role;
select is((select is_banned from public.profiles where id = '00000000-0000-4000-8000-0000000000d5'), false,
  'accepting it lifts the ban');
select is((select count(*)::int from public.resources where author_id = '00000000-0000-4000-8000-0000000000d5' and status = 'published'),
  3, 'and brings the cards back');

-- Two-step actions --------------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d6');
select throws_ok($$select public.delete_content('resource', (select id from public.resources where slug = 'tm-t3'), 'Firibgarlik')$$,
  '42501', null, 'moderators cannot delete content');
select lives_ok($$select public.request_action('delete_resource', (select id from public.resources where slug = 'tm-t3'), 'Firibgarlik sayti')$$,
  'but can ask an admin');
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-0000000000d7');
select lives_ok($$select public.decide_pending_action((select id from public.pending_actions), true)$$,
  'the admin confirms');
reset role;
select is_empty($$select 1 from public.resources where slug = 'tm-t3'$$, 'and the card is deleted');

-- Admin-only tables and server-only functions -----------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-0000000000d6');
select is_empty($$select 1 from public.auth_events$$, 'moderators cannot read auth events');
select throws_ok($$select public.record_reputation((select id from public.resources where slug = 'tm-b1'), 'flagged')$$,
  '42501', null, 'only the server records link reputation');
select throws_ok($$select public.hit_rate_limit('test', 'x', 1, 60)$$, '42501', null, 'only the server counts rate limits');
reset role;

select ok(public.hit_rate_limit('test', 'x', 1, 60), 'the first hit is allowed');
select ok(not public.hit_rate_limit('test', 'x', 1, 60), 'the second hit in the window is not');

select * from finish();
rollback;
