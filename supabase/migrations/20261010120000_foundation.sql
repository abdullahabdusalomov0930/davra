-- Foundation: extensions, the private schema, enums and shared helper functions.

create extension if not exists pg_trgm with schema extensions;

-- Internal helpers live in `private`, which the Data API does not expose (see config.toml `api.schemas`).
-- anon/authenticated need USAGE so RLS policies and triggers can call the helpers that are granted to them.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Functions are executable by PUBLIC by default, and default privileges cannot revoke that per schema.
-- So every migration that adds functions to `private` ends with
-- `revoke execute on all functions in schema private from public;` and grants explicitly.

-- ---------------------------------------------------------------------------
-- Enums (values mirror section 4 of the brief; the UI labels live in messages/uz.json)
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.resource_type as enum ('course', 'video', 'channel', 'book', 'website', 'tool', 'article', 'other');
create type public.resource_language as enum ('uz', 'ru', 'en', 'other');
create type public.resource_price as enum ('free', 'freemium', 'paid');
create type public.resource_level as enum ('beginner', 'intermediate', 'advanced', 'all');
create type public.resource_status as enum ('pending', 'published', 'hidden', 'rejected');
create type public.link_status as enum ('ok', 'broken', 'unknown');
create type public.comment_status as enum ('published', 'hidden');
create type public.report_target as enum ('resource', 'comment', 'user', 'broken_link');
create type public.report_reason as enum ('spam', 'wrong_info', 'inappropriate', 'copyright', 'other');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Lower-cases text and removes every apostrophe variant people type in Uzbek (oʻ o' o‘ o’ o`),
-- so "Oʻzbek", "o'zbek" and "ozbek" become the same search token. Used by the full-text and
-- trigram indexes on resources; search queries must normalize their input with the same function.
create function private.normalize_search_text(input text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
return translate(lower(input), $q$'‘’ʻʼ`´$q$, '');

-- Host of a normalized http(s) URL, without a leading "www.". Resources store it as `domain`.
-- Returns '' for anything else, so an invalid URL fails the clearer `resources_url_format` check.
create function private.url_host(url text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
return coalesce(regexp_replace(substring(url from '^https?://([a-z0-9.-]+)'), '^www\.', ''), '');

-- Popularity score for the "Mashhur" feed (time-decayed):
--
--   score = (likes + 2 * saves + rating_points) / (age_in_days + 2) ^ 1.5
--   rating_points = sum over counted ratings of (stars - 3) = ratings_sum - 3 * ratings_count
--
-- A 5-star rating adds 2 points (as much as a save), a 1-star rating removes 2, a 3-star rating is
-- neutral. Age is counted in days since publication: the site has few posts per day, and with
-- hours a single like on a fresh card would outrank weeks-old cards with hundreds of likes.
-- Recomputed by a trigger whenever a counter changes and for every published resource by a daily job.
create function private.popularity_score(
  likes integer,
  saves integer,
  ratings_count integer,
  ratings_sum integer,
  published_at timestamptz,
  as_of timestamptz
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
return (likes + 2 * saves + (ratings_sum - 3 * ratings_count))::double precision
  / power(greatest(extract(epoch from (as_of - published_at))::double precision / 86400, 0) + 2, 1.5);

grant execute on function private.normalize_search_text(text) to anon, authenticated, service_role;
grant execute on function private.url_host(text) to anon, authenticated, service_role;
grant execute on function private.popularity_score(integer, integer, integer, integer, timestamptz, timestamptz)
  to authenticated, service_role;

revoke execute on all functions in schema private from public;
