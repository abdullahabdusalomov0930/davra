-- Likes, saves, ratings, comments and follows: abuse rules and the counters kept by triggers.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

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

-- A = author, L = established user, F = fresh account (< 24 h), M = moderator, B = banned.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000021', 'a@test.uz', '{"username": "author"}'),
  ('00000000-0000-4000-8000-000000000022', 'l@test.uz', '{"username": "liker"}'),
  ('00000000-0000-4000-8000-000000000023', 'f@test.uz', '{"username": "fresh"}'),
  ('00000000-0000-4000-8000-000000000024', 'm@test.uz', '{"username": "moder"}'),
  ('00000000-0000-4000-8000-000000000025', 'b@test.uz', '{"username": "banned"}');
update public.profiles set created_at = now() - interval '10 days'
  where id <> '00000000-0000-4000-8000-000000000023' and id::text like '00000000-0000-4000-8000-0000000000%';
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000024';
update public.profiles set is_banned = true where id = '00000000-0000-4000-8000-000000000025';

insert into public.resources (id, slug, author_id, topic_id, title, url, type, language, price, level, summary, for_whom, status)
select id::uuid, slug, '00000000-0000-4000-8000-000000000021', (select id from public.topics where slug = 'ielts'),
  'IELTS resursi ' || slug, 'https://example.com/ielts/' || slug, 'video', 'en', 'free', 'intermediate',
  'IELTS imtihonining barcha boʻlimlari boʻyicha amaliy maslahatlar va namunalar.', 'IELTSga tayyorlanayotganlar uchun',
  status::public.resource_status
from (values
  ('00000000-0000-4000-8000-0000000000a1', 'r-pub', 'published'),
  ('00000000-0000-4000-8000-0000000000a2', 'r-pub-2', 'published'),
  ('00000000-0000-4000-8000-0000000000a3', 'r-pend', 'pending')
) as t (id, slug, status);

-- Likes ---------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000022", "role": "authenticated"}';

select lives_ok(
  $$insert into public.resource_likes (resource_id) select id from public.resources where slug = 'r-pub'$$,
  'users can like a published resource'
);

select results_eq(
  $$select likes_count, round(popularity_score::numeric, 4) from public.resources where slug = 'r-pub'$$,
  $$values (1, 0.3536)$$,
  'the like is counted and the popularity score is recomputed (1 / 2^1.5)'
);

select throws_ok(
  $$insert into public.resource_likes (resource_id) select id from public.resources where slug = 'r-pub'$$,
  '23505', null,
  'a resource can be liked only once per user'
);

select throws_ok(
  $$insert into public.resource_likes (resource_id) values ('00000000-0000-4000-8000-0000000000ff')$$,
  '42501', null,
  'unknown resources cannot be liked'
);

select is((select count(*)::integer from public.resource_likes), 1, 'users see their own likes');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000021", "role": "authenticated"}';

select throws_ok(
  $$insert into public.resource_likes (resource_id) select id from public.resources where slug = 'r-pub'$$,
  '42501', null,
  'authors cannot like their own resource'
);

select throws_ok(
  $$insert into public.resource_saves (resource_id) select id from public.resources where slug = 'r-pub'$$,
  '42501', null,
  'authors cannot save their own resource'
);

select is_empty($$select 1 from public.resource_likes$$, 'likes are private to the user who gave them');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000022", "role": "authenticated"}';

select throws_ok(
  $$insert into public.resource_likes (resource_id) values ('00000000-0000-4000-8000-0000000000a3')$$,
  '42501', null,
  'pending resources cannot be liked'
);

select lives_ok(
  $$delete from public.resource_likes where resource_id = (select id from public.resources where slug = 'r-pub')$$,
  'users can remove their like'
);

select results_eq(
  $$select likes_count, popularity_score from public.resources where slug = 'r-pub'$$,
  $$values (0, 0::double precision)$$,
  'removing the like decrements the counter and the score'
);

-- Saves ---------------------------------------------------------------------------------

select lives_ok(
  $$insert into public.resource_saves (resource_id) select id from public.resources where slug = 'r-pub'$$,
  'users can save a resource'
);

select is((select saves_count from public.resources where slug = 'r-pub'), 1, 'saves are counted');

-- Ratings -------------------------------------------------------------------------------

select lives_ok(
  $$insert into public.resource_ratings (resource_id, stars, review_text)
    select id, 5, 'Juda foydali, ayniqsa Writing qismi.' from public.resources where slug = 'r-pub'$$,
  'users can rate a resource with a short review'
);

select results_eq(
  $$select ratings_count, ratings_sum from public.resources where slug = 'r-pub'$$,
  $$values (1, 5)$$,
  'the rating is counted'
);

select throws_ok(
  $$insert into public.resource_ratings (resource_id, stars) select id, 4 from public.resources where slug = 'r-pub'$$,
  '23505', null,
  'one rating per user per resource'
);

select throws_ok(
  $$update public.resource_ratings set counts_in_average = true$$,
  '42501', null,
  'users cannot decide whether their rating counts'
);

select throws_ok(
  $$insert into public.resource_ratings (resource_id, stars) select id, 6 from public.resources where slug = 'r-pub-2'$$,
  '23514', null,
  'stars must be between 1 and 5'
);

select lives_ok(
  $$update public.resource_ratings set stars = 4 where resource_id = (select id from public.resources where slug = 'r-pub')$$,
  'users can change their rating'
);

select results_eq(
  $$select ratings_count, ratings_sum from public.resources where slug = 'r-pub'$$,
  $$values (1, 4)$$,
  'changing the rating updates the sum'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000023", "role": "authenticated"}';

select lives_ok(
  $$insert into public.resource_ratings (resource_id, stars) select id, 1 from public.resources where slug = 'r-pub'$$,
  'a fresh account can rate'
);

select results_eq(
  $$select r.ratings_count, r.ratings_sum, rr.counts_in_average
    from public.resources r join public.resource_ratings rr on rr.resource_id = r.id
    where r.slug = 'r-pub' and rr.user_id = '00000000-0000-4000-8000-000000000023'$$,
  $$values (1, 4, false)$$,
  'ratings from accounts younger than 24 hours are shown but not counted'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000021", "role": "authenticated"}';

select throws_ok(
  $$insert into public.resource_ratings (resource_id, stars) select id, 5 from public.resources where slug = 'r-pub'$$,
  '42501', null,
  'authors cannot rate their own resource'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select count(*)::integer from public.resource_ratings),
  2,
  'ratings and reviews are public'
);

-- Comments ---------------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000022", "role": "authenticated"}';

select lives_ok(
  $$insert into public.comments (resource_id, body) select id, 'Rahmat, juda kerakli resurs!' from public.resources where slug = 'r-pub'$$,
  'users can comment'
);

select is((select comments_count from public.resources where slug = 'r-pub'), 1, 'comments are counted');

select throws_ok(
  $$insert into public.comments (resource_id, body) select id, '   ' from public.resources where slug = 'r-pub'$$,
  '23514', null,
  'empty comments are rejected'
);

update public.comments set status = 'hidden';

select is((select status::text from public.comments), 'published', 'users cannot hide comments');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000024", "role": "authenticated"}';

select lives_ok($$update public.comments set status = 'hidden'$$, 'moderators can hide a comment');

select results_eq(
  $$select r.comments_count, a.action from public.resources r, public.audit_log a
    where r.slug = 'r-pub' and a.target_type = 'comment'$$,
  $$values (0, 'comment.status')$$,
  'hidden comments are not counted, and hiding is audited'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty($$select 1 from public.comments$$, 'guests do not see hidden comments');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000022", "role": "authenticated"}';

select lives_ok($$delete from public.comments$$, 'authors can delete their comment, even a hidden one');

select is((select comments_count from public.resources where slug = 'r-pub'), 0, 'deleting a hidden comment does not change the count');

-- Follows -----------------------------------------------------------------------------------

select lives_ok(
  $$insert into public.follows_users (followed_id) values ('00000000-0000-4000-8000-000000000021')$$,
  'users can follow another user'
);

select throws_ok(
  $$insert into public.follows_users (followed_id) values ('00000000-0000-4000-8000-000000000022')$$,
  '23514', null,
  'users cannot follow themselves'
);

select lives_ok(
  $$insert into public.follows_topics (topic_id) select id from public.topics where slug = 'ielts'$$,
  'users can follow a topic'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000023", "role": "authenticated"}';

select ok(
  not exists (select 1 from public.follows_users) and not exists (select 1 from public.follows_topics),
  'follows are private to the two people involved'
);

-- Banned users ---------------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000025", "role": "authenticated"}';

select throws_ok(
  $$insert into public.resource_likes (resource_id) select id from public.resources where slug = 'r-pub'$$,
  '42501', null,
  'banned users cannot like'
);

select throws_ok(
  $$insert into public.comments (resource_id, body) select id, 'Spam' from public.resources where slug = 'r-pub'$$,
  '42501', null,
  'banned users cannot comment'
);

-- Popularity score ------------------------------------------------------------------------------

reset role;
set local request.jwt.claims = '';

select is(
  round(private.popularity_score(10, 5, 2, 9, '2026-01-01', '2026-01-02')::numeric, 4),
  4.4264,
  'score = (likes + 2*saves + (ratings_sum - 3*ratings_count)) / (age_days + 2)^1.5'
);

select ok(
  private.popularity_score(10, 0, 0, 0, '2026-01-01', '2026-01-02')
    > private.popularity_score(10, 0, 0, 0, '2026-01-01', '2026-01-31'),
  'the score decays with age'
);

select ok(
  private.popularity_score(0, 0, 2, 2, '2026-01-01', '2026-01-01') < 0,
  'low ratings pull the score down'
);

-- Deleting an account removes its interactions and fixes the counters --------------------------------

insert into public.resource_likes (user_id, resource_id)
select '00000000-0000-4000-8000-000000000022', id from public.resources where slug = 'r-pub-2';
delete from auth.users where id = '00000000-0000-4000-8000-000000000022';

select results_eq(
  $$select likes_count, saves_count, ratings_count from public.resources where slug in ('r-pub', 'r-pub-2') order by slug$$,
  $$values (0, 0, 0), (0, 0, 0)$$,
  'a deleted account''s likes, saves and ratings disappear from the counters'
);

select * from finish();
rollback;
