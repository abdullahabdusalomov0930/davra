-- Scheduled jobs (pg_cron, available on every Supabase plan as "Supabase Cron").

create extension if not exists pg_cron with schema pg_catalog;

-- Popularity decays with age even when nobody interacts, so every published score is recomputed
-- daily. Interactions recompute their resource's score immediately (resources update trigger).
create function private.refresh_popularity_scores()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.resources
  set popularity_score = private.popularity_score(
    likes_count, saves_count, ratings_count, ratings_sum, coalesce(published_at, created_at), now()
  )
  where status = 'published';
$$;

-- 21:00 UTC = 02:00 in Tashkent. Scheduling under an existing name replaces that job.
select cron.schedule('refresh-popularity-scores', '0 21 * * *', 'select private.refresh_popularity_scores()');

revoke execute on all functions in schema private from public;
