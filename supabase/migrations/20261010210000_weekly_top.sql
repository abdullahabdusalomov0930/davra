-- "Haftalik Top 10" (/haftalik, DECISIONS.md D60): the published resources people engaged with most in
-- the last 7 days, with the weights of the popularity score (D19): a like counts 1, a save 2, and a
-- counted rating (stars - 3), so a 5-star rating adds 2 and a 1-star rating takes 2 away.

create index resource_likes_created_idx on public.resource_likes (created_at);
create index resource_saves_created_idx on public.resource_saves (created_at);
create index resource_ratings_created_idx on public.resource_ratings (created_at);

-- SECURITY DEFINER: likes and saves are private rows (each user sees only their own), so counting them
-- needs the owner's rights. Only per-resource totals of public resources come out, never who did what;
-- the all-time totals are public on the cards already.
create function public.weekly_top_resources(max_count integer default 10)
returns table (resource_id uuid, week_likes integer, week_saves integer, week_ratings integer, week_points integer)
language sql
stable
security definer
set search_path = ''
as $$
  with window_start as (
    select now() - interval '7 days' as at
  ),
  likes as (
    select l.resource_id, count(*)::integer as n
    from public.resource_likes l, window_start w
    where l.created_at > w.at
    group by l.resource_id
  ),
  saves as (
    select s.resource_id, count(*)::integer as n
    from public.resource_saves s, window_start w
    where s.created_at > w.at
    group by s.resource_id
  ),
  ratings as (
    select r.resource_id, count(*)::integer as n, sum(r.stars - 3)::integer as points
    from public.resource_ratings r, window_start w
    where r.created_at > w.at and r.counts_in_average
    group by r.resource_id
  ),
  scored as (
    select
      x.id,
      coalesce(l.n, 0) as likes,
      coalesce(s.n, 0) as saves,
      coalesce(rt.n, 0) as ratings,
      coalesce(l.n, 0) + 2 * coalesce(s.n, 0) + coalesce(rt.points, 0) as points,
      x.popularity_score,
      x.published_at
    from public.resources x
    left join likes l on l.resource_id = x.id
    left join saves s on s.resource_id = x.id
    left join ratings rt on rt.resource_id = x.id
    where x.status = 'published'
      and x.link_status <> 'broken'
      and (l.n is not null or s.n is not null or rt.n is not null)
  )
  select id, likes, saves, ratings, points
  from scored
  where points > 0
  order by points desc, popularity_score desc, published_at desc, id
  limit least(greatest(coalesce(max_count, 10), 1), 50);
$$;

revoke execute on function public.weekly_top_resources(integer) from public;
grant execute on function public.weekly_top_resources(integer) to anon, authenticated, service_role;
