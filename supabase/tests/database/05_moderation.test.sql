-- Reports, the trust rule, staff tools (blocked domains, topics, hiding) and the audit log.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

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

-- R = reporter, A = trusted author, M = moderator, X = admin, O = other user.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000031', 'r@test.uz', '{"username": "reporter"}'),
  ('00000000-0000-4000-8000-000000000032', 'a@test.uz', '{"username": "author"}'),
  ('00000000-0000-4000-8000-000000000033', 'm@test.uz', '{"username": "moder"}'),
  ('00000000-0000-4000-8000-000000000034', 'x@test.uz', '{"username": "admin"}'),
  ('00000000-0000-4000-8000-000000000035', 'o@test.uz', '{"username": "other"}');
update public.profiles set created_at = now() - interval '10 days' where id::text like '00000000-0000-4000-8000-0000000000%';
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000033';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000034';

insert into public.resources (id, slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status)
select ('00000000-0000-4000-8000-0000000000b' || n)::uuid, 'resurs-' || n, '00000000-0000-4000-8000-000000000032',
  (select id from public.topics where slug = 'dizayn'), 'Dizayn resursi ' || n, 'https://example.com/design/' || n,
  'tool', 'en', 'freemium', 'beginner', 'Figma va boshqa dizayn vositalarida ishlashni oʻrgatadigan resurs.',
  'Dizaynni oʻrganayotganlar uchun', 'published'
from generate_series(1, 3) as n;

insert into public.comments (id, resource_id, author_id, body)
values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1',
  '00000000-0000-4000-8000-000000000032', 'Muallif izohi');

-- Reporting -------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000031", "role": "authenticated"}';

select lives_ok(
  $$insert into public.reports (target_type, target_id, reason, details)
    values ('resource', '00000000-0000-4000-8000-0000000000b1', 'spam', 'Reklama')$$,
  'users can report a resource'
);

select results_eq(
  $$select reporter_id::text, target_owner_id::text, status::text from public.reports where target_type = 'resource'$$,
  $$values ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000032', 'open')$$,
  'the report records the reporter and the owner of the reported content'
);

select throws_ok(
  $$insert into public.reports (target_type, target_id, reason) values ('resource', '00000000-0000-4000-8000-0000000000b1', 'other')$$,
  '23505', null,
  'one open report per user and target'
);

select lives_ok(
  $$insert into public.reports (target_type, target_id) values ('broken_link', '00000000-0000-4000-8000-0000000000b1')$$,
  'users can report a broken link without a reason'
);

select throws_ok(
  $$insert into public.reports (target_type, target_id) values ('broken_link', '00000000-0000-4000-8000-0000000000b1')$$,
  '23505', null,
  'one broken-link report per user and resource'
);

select throws_ok(
  $$insert into public.reports (target_type, target_id) values ('comment', '00000000-0000-4000-8000-0000000000c1')$$,
  '23514', null,
  'other reports need a reason'
);

select throws_ok(
  $$insert into public.reports (target_type, target_id, reason) values ('user', '00000000-0000-4000-8000-0000000000ff', 'spam')$$,
  '23503', null,
  'reports must point at an existing target'
);

select lives_ok(
  $$insert into public.reports (target_type, target_id, reason) values
    ('comment', '00000000-0000-4000-8000-0000000000c1', 'inappropriate'),
    ('user', '00000000-0000-4000-8000-000000000032', 'spam')$$,
  'users can report comments and users'
);

select throws_ok(
  $$insert into public.reports (target_type, target_id, reason, status)
    values ('resource', '00000000-0000-4000-8000-0000000000b2', 'spam', 'resolved')$$,
  '42501', null,
  'reporters cannot set the status'
);

update public.reports set status = 'dismissed';

select is(
  (select count(*)::integer from public.reports where status = 'open'),
  4,
  'reporters see their own reports but cannot handle them'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000035", "role": "authenticated"}';

select is_empty($$select 1 from public.reports$$, 'other users cannot see someone''s reports');

-- Handling reports and trust ------------------------------------------------------------------

reset role;
set local request.jwt.claims = '';

select ok(private.is_trusted_author('00000000-0000-4000-8000-000000000032'), 'the author starts out trusted');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000033", "role": "authenticated"}';

select is((select count(*)::integer from public.reports), 4, 'moderators see all reports');

update public.reports set status = 'resolved' where target_type = 'broken_link';

select ok(
  private.is_trusted_author('00000000-0000-4000-8000-000000000032'),
  'a confirmed broken link does not cost the author their trust'
);

select lives_ok(
  $$update public.reports set status = 'resolved' where target_type = 'resource'$$,
  'moderators can resolve a report'
);

select results_eq(
  $$select handled_by::text, handled_at is not null from public.reports where target_type = 'resource'$$,
  $$values ('00000000-0000-4000-8000-000000000033', true)$$,
  'resolving records who handled the report and when'
);

select ok(
  not private.is_trusted_author('00000000-0000-4000-8000-000000000032'),
  'a confirmed report against their content makes the author untrusted'
);

update public.reports set status = 'open' where target_type = 'resource';

select results_eq(
  $$select status::text, handled_by is null, handled_at is null from public.reports where target_type = 'resource'$$,
  $$values ('open', true, true)$$,
  'reopening a report clears the handler'
);

select results_eq(
  $$select action, details ->> 'to' from public.audit_log where target_type = 'report' order by details ->> 'to'$$,
  $$values ('report.status', 'open'), ('report.status', 'resolved'), ('report.status', 'resolved')$$,
  'every report status change is audited'
);

-- Hiding resources and overriding link status ------------------------------------------------------

select lives_ok(
  $$update public.resources set status = 'hidden' where id = '00000000-0000-4000-8000-0000000000b2'$$,
  'moderators can hide a resource'
);

select lives_ok(
  $$update public.resources set link_status = 'broken' where id = '00000000-0000-4000-8000-0000000000b3'$$,
  'moderators can mark a link as broken'
);

select results_eq(
  $$select action, target_id from public.audit_log where target_type = 'resource' order by action$$,
  $$values ('resource.link_status', '00000000-0000-4000-8000-0000000000b3'),
           ('resource.status', '00000000-0000-4000-8000-0000000000b2')$$,
  'hiding and link overrides are audited'
);

select throws_ok($$delete from public.audit_log$$, '42501', null, 'not even staff can delete audit entries');

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty(
  $$select 1 from public.resources where id = '00000000-0000-4000-8000-0000000000b2'$$,
  'hidden resources disappear for the public'
);

-- Blocked domains (admin) ---------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000031", "role": "authenticated"}';

select is_empty($$select 1 from public.blocked_domains$$, 'regular users cannot read the blocklist');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000033", "role": "authenticated"}';

select throws_ok(
  $$insert into public.blocked_domains (domain) values ('spam.example')$$,
  '42501', null,
  'moderators cannot change the blocklist'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000034", "role": "authenticated"}';

select throws_ok(
  $$insert into public.blocked_domains (domain) values ('Not a domain')$$,
  '23514', null,
  'blocked domains must be valid lower-case host names'
);

select lives_ok(
  $$insert into public.blocked_domains (domain, reason) values ('spam.example', 'Spam')$$,
  'admins can block a domain'
);

select lives_ok($$delete from public.blocked_domains where domain = 'spam.example'$$, 'admins can unblock a domain');

-- Topics (admin) ----------------------------------------------------------------------------

select lives_ok(
  $$insert into public.topics (slug, name_uz, sort_order) values ('robototexnika', 'Robototexnika', 130)$$,
  'admins can create topics'
);

select lives_ok(
  $$update public.topics set name_uz = 'Robototexnika va IoT' where slug = 'robototexnika'$$,
  'admins can rename topics'
);

select throws_ok(
  $$delete from public.topics where slug = 'dizayn'$$,
  '23503', null,
  'topics that still have resources cannot be deleted'
);

select results_eq(
  $$select action, target_id, details -> 'after' ->> 'name_uz' from public.audit_log
    where target_type in ('topic', 'blocked_domain') order by action$$,
  $$values ('blocked_domain.delete', 'spam.example', null),
           ('blocked_domain.insert', 'spam.example', null),
           ('topic.insert', (select id::text from public.topics where slug = 'robototexnika'), 'Robototexnika'),
           ('topic.update', (select id::text from public.topics where slug = 'robototexnika'), 'Robototexnika va IoT')$$,
  'blocklist and topic changes are audited with before/after values'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000033", "role": "authenticated"}';

select throws_ok(
  $$insert into public.topics (slug, name_uz) values ('boshqa', 'Boshqa')$$,
  '42501', null,
  'moderators cannot create topics'
);

select * from finish();
rollback;
