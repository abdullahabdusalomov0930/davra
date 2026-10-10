-- Interactions: likes, saves, ratings, comments and follows, plus the counter triggers that keep
-- resources.*_count in sync. Counters are written only here, never by client code.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.resource_likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create index resource_likes_resource_idx on public.resource_likes (resource_id);

create table public.resource_saves (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create index resource_saves_resource_idx on public.resource_saves (resource_id);
-- "Saqlanganlar" page, newest first.
create index resource_saves_user_created_idx on public.resource_saves (user_id, created_at desc);

create table public.resource_ratings (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  stars smallint not null,
  review_text text,
  -- False for ratings given by accounts younger than 24 hours: they are shown, but left out of the
  -- average and the popularity score. Recomputed whenever the rating is edited.
  counts_in_average boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, resource_id),

  constraint resource_ratings_stars_range check (stars between 1 and 5),
  constraint resource_ratings_review_text_length check (char_length(btrim(review_text)) between 1 and 500)
);

create index resource_ratings_resource_idx on public.resource_ratings (resource_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null,
  status public.comment_status not null default 'published',
  created_at timestamptz not null default now(),

  constraint comments_body_length check (char_length(btrim(body)) between 1 and 500)
);

create index comments_resource_idx on public.comments (resource_id, created_at);
create index comments_author_idx on public.comments (author_id);

create table public.follows_users (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),

  constraint follows_users_not_self check (follower_id <> followed_id)
);

create index follows_users_followed_idx on public.follows_users (followed_id);

create table public.follows_topics (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index follows_topics_topic_idx on public.follows_topics (topic_id);

-- ---------------------------------------------------------------------------
-- Ratings: decide whether a rating counts towards the average
-- ---------------------------------------------------------------------------

create function private.prepare_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.counts_in_average := exists (
    select 1 from public.profiles
    where id = new.user_id and created_at <= now() - interval '24 hours'
  );
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger prepare_rating
  before insert or update on public.resource_ratings
  for each row execute function private.prepare_rating();

-- ---------------------------------------------------------------------------
-- Counter triggers. SECURITY DEFINER: users cannot update resources they do not own.
-- Updating a counter fires the resources update trigger, which recomputes the popularity score.
-- ---------------------------------------------------------------------------

create function private.count_resource_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.resources set likes_count = likes_count + 1 where id = new.resource_id;
  else
    update public.resources set likes_count = greatest(likes_count - 1, 0) where id = old.resource_id;
  end if;
  return null;
end;
$$;

create trigger count_like
  after insert or delete on public.resource_likes
  for each row execute function private.count_resource_like();

create function private.count_resource_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.resources set saves_count = saves_count + 1 where id = new.resource_id;
  else
    update public.resources set saves_count = greatest(saves_count - 1, 0) where id = old.resource_id;
  end if;
  return null;
end;
$$;

create trigger count_save
  after insert or delete on public.resource_saves
  for each row execute function private.count_resource_save();

create function private.count_resource_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta_count integer := 0;
  delta_sum integer := 0;
  target uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    target := old.resource_id;
    if old.counts_in_average then
      delta_count := delta_count - 1;
      delta_sum := delta_sum - old.stars;
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    target := new.resource_id;
    if new.counts_in_average then
      delta_count := delta_count + 1;
      delta_sum := delta_sum + new.stars;
    end if;
  end if;

  if delta_count <> 0 or delta_sum <> 0 then
    update public.resources
    set ratings_count = greatest(ratings_count + delta_count, 0),
        ratings_sum = greatest(ratings_sum + delta_sum, 0)
    where id = target;
  end if;
  return null;
end;
$$;

create trigger count_rating
  after insert or update or delete on public.resource_ratings
  for each row execute function private.count_resource_rating();

-- comments_count counts published comments only.
create function private.count_resource_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta integer := 0;
  target uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    target := old.resource_id;
    delta := delta - (old.status = 'published')::integer;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    target := new.resource_id;
    delta := delta + (new.status = 'published')::integer;
  end if;

  if delta <> 0 then
    update public.resources set comments_count = greatest(comments_count + delta, 0) where id = target;
  end if;
  return null;
end;
$$;

create trigger count_comment
  after insert or update or delete on public.comments
  for each row execute function private.count_resource_comment();

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------

revoke all on table public.resource_likes, public.resource_saves, public.resource_ratings, public.comments,
  public.follows_users, public.follows_topics
  from anon, authenticated;

grant select, delete on table public.resource_likes, public.resource_saves to authenticated;
grant insert (resource_id) on table public.resource_likes, public.resource_saves to authenticated;

grant select on table public.resource_ratings to anon, authenticated;
grant insert (resource_id, stars, review_text), update (stars, review_text), delete
  on table public.resource_ratings to authenticated;

grant select on table public.comments to anon, authenticated;
grant insert (resource_id, body), update (status), delete on table public.comments to authenticated;

grant select, delete on table public.follows_users, public.follows_topics to authenticated;
grant insert (followed_id) on table public.follows_users to authenticated;
grant insert (topic_id) on table public.follows_topics to authenticated;

alter table public.resource_likes enable row level security;
alter table public.resource_saves enable row level security;
alter table public.resource_ratings enable row level security;
alter table public.comments enable row level security;
alter table public.follows_users enable row level security;
alter table public.follows_topics enable row level security;

-- Likes and saves are private; the public sees only the counters.
-- Nobody can like, save or rate their own resource, and only published resources can be liked.

create policy "Users see their own likes"
  on public.resource_likes for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Active users can like others' published resources"
  on public.resource_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_active_user())
    and exists (
      select 1 from public.resources r
      where r.id = resource_id and r.status = 'published' and r.author_id <> (select auth.uid())
    )
  );

create policy "Active users can remove their likes"
  on public.resource_likes for delete
  to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_user()));

create policy "Users see their own saves"
  on public.resource_saves for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Active users can save others' published resources"
  on public.resource_saves for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_active_user())
    and exists (
      select 1 from public.resources r
      where r.id = resource_id and r.status = 'published' and r.author_id <> (select auth.uid())
    )
  );

create policy "Active users can remove their saves"
  on public.resource_saves for delete
  to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_user()));

-- Ratings and reviews are public wherever the resource itself is visible.
create policy "Ratings of visible resources are public"
  on public.resource_ratings for select
  to anon, authenticated
  using (exists (select 1 from public.resources r where r.id = resource_id));

create policy "Active users can rate others' published resources"
  on public.resource_ratings for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_active_user())
    and exists (
      select 1 from public.resources r
      where r.id = resource_id and r.status = 'published' and r.author_id <> (select auth.uid())
    )
  );

create policy "Active users can edit their ratings"
  on public.resource_ratings for update
  to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_user()))
  with check (user_id = (select auth.uid()) and (select private.is_active_user()));

create policy "Active users can delete their ratings"
  on public.resource_ratings for delete
  to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_user()));

-- Comments: published comments on visible resources are public; authors see their hidden ones.
-- Comments cannot be edited, only deleted; staff hide them instead of deleting.
create policy "Published comments are public; authors and staff see the rest"
  on public.comments for select
  to anon, authenticated
  using (
    (status = 'published' and exists (select 1 from public.resources r where r.id = resource_id))
    or author_id = (select auth.uid())
    or (select private.is_staff())
  );

create policy "Active users can comment on published resources"
  on public.comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_active_user())
    and exists (select 1 from public.resources r where r.id = resource_id and r.status = 'published')
  );

create policy "Staff can hide comments"
  on public.comments for update
  to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create policy "Active users can delete their comments"
  on public.comments for delete
  to authenticated
  using (author_id = (select auth.uid()) and (select private.is_active_user()));

-- Follows are private: users see whom they follow and who follows them.
create policy "Users see their own follow relations"
  on public.follows_users for select
  to authenticated
  using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));

create policy "Active users can follow users"
  on public.follows_users for insert
  to authenticated
  with check (follower_id = (select auth.uid()) and (select private.is_active_user()));

create policy "Active users can unfollow users"
  on public.follows_users for delete
  to authenticated
  using (follower_id = (select auth.uid()) and (select private.is_active_user()));

create policy "Users see the topics they follow"
  on public.follows_topics for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Active users can follow topics"
  on public.follows_topics for insert
  to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active_user()));

create policy "Active users can unfollow topics"
  on public.follows_topics for delete
  to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_user()));

revoke execute on all functions in schema private from public;
