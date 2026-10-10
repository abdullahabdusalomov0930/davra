-- Search, feeds and topic pages: one read path for every list of resources (DECISIONS.md D45–D48).

-- ---------------------------------------------------------------------------
-- "Eng yaxshilari" (top rated). The average rating is pulled towards a neutral 3 by two virtual
-- ratings, so a single 5-star rating does not outrank many good ones:
--
--   rating_score = (ratings_sum + 2 * 3) / (ratings_count + 2)
--
-- No ratings → 3.00; one 5★ → 3.67; ten ratings averaging 4.5 → 4.25; one 1★ → 2.33.
-- Only ratings that count towards the average are in ratings_sum/ratings_count (D18).
-- ---------------------------------------------------------------------------

alter table public.resources
  add column rating_score double precision
  generated always as ((ratings_sum + 6)::double precision / (ratings_count + 2)) stored not null;

create index resources_top_idx on public.resources (rating_score desc, ratings_count desc, published_at desc, id desc)
  where status = 'published';
create index resources_topic_top_idx on public.resources (topic_id, rating_score desc, ratings_count desc, published_at desc)
  where status = 'published';

-- ---------------------------------------------------------------------------
-- Prefix query: "pyth asos" → 'pyth':* & 'asos':*. Tokenized and normalized exactly like
-- resources.search_vector, so apostrophes and case never matter. Prefix matching also helps with
-- Uzbek suffixes when the query is the shorter form ("dastur" finds "dasturlash").
-- Returns null when nothing searchable is left.
-- ---------------------------------------------------------------------------

create function private.prefix_tsquery(input text)
returns tsquery
language sql
immutable
parallel safe
set search_path = ''
return (
  select to_tsquery(
    'simple'::regconfig,
    string_agg('''' || replace(replace(t.lexeme, '\', '\\'), '''', '''''') || ''':*', ' & ')
  )
  from unnest(to_tsvector('simple'::regconfig, private.normalize_search_text(input))) as t
);

grant execute on function private.prefix_tsquery(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- search_resources: the feed, topic pages, related resources and the search page all call this.
--
-- * Only published resources (explicitly, on top of RLS, so authors never see their own pending
--   cards in public lists). Runs with the caller's rights.
-- * Text: every word of the query (up to 8) must match, either as a full-text prefix in the title,
--   summary or for_whom, or fuzzily in the title (trigram word_similarity ≥ 0.4, words of 3+
--   characters), so "pyhton asoslari" finds "Python asoslari" but not "Shaxsiy moliya asoslari".
--   `alt_search_text` is a second spelling of the same query (the app passes the Latin
--   transliteration of a Cyrillic query); a word matches if either spelling does.
-- * Sorts: relevance (text queries only), newest, popular (time-decayed, broken links left out),
--   top (rating_score). Ties are broken by published_at, then id.
-- * Pages: every row comes with `next_cursor`, the cursor of the page that starts after it; the app
--   passes the last row's cursor back as `after_cursor`. Keyset for newest/popular/top
--   (p = published_at, i = id, s = popularity_score, r = rating_score, c = ratings_count; floats as
--   exact text, hence extra_float_digits), offset (o) for relevance, which is fine for a few pages.
--
-- Returns ids in order; the app loads the cards (with topic and author) by id.
-- At MVP scale the per-word conditions are cheap; the filters and sorts use the partial indexes.
-- ---------------------------------------------------------------------------

create function public.search_resources(
  search_text text default null,
  alt_search_text text default null,
  topic_id uuid default null,
  resource_type public.resource_type default null,
  resource_language public.resource_language default null,
  resource_price public.resource_price default null,
  resource_level public.resource_level default null,
  sort_by text default 'newest',
  after_cursor jsonb default null,
  page_size integer default 20
)
returns table (id uuid, next_cursor jsonb)
language plpgsql
stable
set search_path = ''
set extra_float_digits = 1
as $$
declare
  query_text text := private.normalize_search_text(nullif(btrim(left(search_text, 100)), ''));
  alt_text text := private.normalize_search_text(nullif(btrim(left(alt_search_text, 100)), ''));
  query_words text[] := (regexp_split_to_array(query_text, '\s+'))[1:8];
  alt_words text[] := (regexp_split_to_array(alt_text, '\s+'))[1:8];
  word_queries tsquery[] := '{}';
  word_texts text[] := '{}';
  alt_word_texts text[] := '{}';
  any_word_query tsquery;
  word_query tsquery;
  alt_query tsquery;
  sort_mode text := coalesce(sort_by, 'newest');
  row_limit integer := least(greatest(coalesce(page_size, 20), 1), 50);
  row_offset integer := 0;
  title_text constant text := 'private.normalize_search_text(r.title)';
  relevance_sql text := 'null::real';
  match_sql text := 'true';
  keyset_sql text := 'true';
  order_sql text;
  cursor_sql text;
begin
  if sort_mode not in ('relevance', 'newest', 'popular', 'top') then
    raise exception 'unknown sort: %', sort_mode using errcode = '22023';
  end if;

  -- One full-text prefix query per word (either spelling), plus the words for fuzzy matching.
  for i in 1 .. coalesce(cardinality(query_words), 0) loop
    word_query := private.prefix_tsquery(query_words[i]);
    alt_query := private.prefix_tsquery(alt_words[i]);
    continue when word_query is null and alt_query is null;

    word_query := case
      when word_query is null then alt_query
      when alt_query is null then word_query
      else word_query || alt_query
    end;
    word_queries := word_queries || word_query;
    -- Trigrams of one or two characters match almost anything.
    word_texts := word_texts || case when char_length(query_words[i]) >= 3 then query_words[i] end;
    alt_word_texts := alt_word_texts || case when char_length(alt_words[i]) >= 3 then alt_words[i] end;
    any_word_query := case when any_word_query is null then word_query else any_word_query || word_query end;
  end loop;

  if cardinality(word_queries) = 0 then
    -- Nothing searchable (empty or only punctuation): a plain list.
    if sort_mode = 'relevance' then
      sort_mode := 'newest';
    end if;
  else
    select string_agg(
      format(
        '(r.search_vector @@ $6[%1$s]
          or ($7[%1$s] is not null and extensions.word_similarity($7[%1$s], %2$s) >= 0.4)
          or ($8[%1$s] is not null and extensions.word_similarity($8[%1$s], %2$s) >= 0.4))',
        n, title_text
      ),
      ' and '
    )
    into match_sql
    from generate_series(1, cardinality(word_queries)) as n;

    relevance_sql := format(
      '(ts_rank(r.search_vector, $9)
        + coalesce(greatest(extensions.word_similarity($10, %1$s), extensions.word_similarity($11, %1$s)), 0))::real',
      title_text
    );
  end if;

  case sort_mode
    when 'relevance' then
      order_sql := 'relevance desc, published_at desc, id desc';
      row_offset := least(greatest(coalesce((after_cursor ->> 'o')::integer, 0), 0), 1000);
      cursor_sql := format('jsonb_build_object(''o'', %s + row_number() over (order by %s))', row_offset, order_sql);
    when 'newest' then
      order_sql := 'published_at desc, id desc';
      cursor_sql := 'jsonb_build_object(''p'', s.published_at, ''i'', s.id)';
      if after_cursor is not null then
        keyset_sql := '(r.published_at, r.id) < ($12, $13)';
      end if;
    when 'popular' then
      order_sql := 'popularity_score desc, published_at desc, id desc';
      cursor_sql := 'jsonb_build_object(''p'', s.published_at, ''i'', s.id, ''s'', s.popularity_score::text)';
      if after_cursor is not null then
        keyset_sql := '(r.popularity_score, r.published_at, r.id) < ($14, $12, $13)';
      end if;
      match_sql := match_sql || ' and r.link_status <> ''broken''';
    when 'top' then
      order_sql := 'rating_score desc, ratings_count desc, published_at desc, id desc';
      cursor_sql := 'jsonb_build_object(''p'', s.published_at, ''i'', s.id, ''r'', s.rating_score::text, ''c'', s.ratings_count)';
      if after_cursor is not null then
        keyset_sql := '(r.rating_score, r.ratings_count, r.published_at, r.id) < ($15, $16, $12, $13)';
      end if;
  end case;

  -- Only fixed SQL fragments are formatted in; every value is passed as a parameter.
  return query execute format(
    'select s.id, %s
     from (
       select r.id, r.published_at, r.popularity_score, r.rating_score, r.ratings_count, %s as relevance
       from public.resources r
       where r.status = ''published''
         and ($1::uuid is null or r.topic_id = $1)
         and ($2::public.resource_type is null or r.type = $2)
         and ($3::public.resource_language is null or r.language = $3)
         and ($4::public.resource_price is null or r.price = $4)
         and ($5::public.resource_level is null or r.level = $5)
         and %s
         and %s
       order by %s
       limit $17 offset $18
     ) s
     order by %s',
    cursor_sql,
    relevance_sql,
    match_sql,
    keyset_sql,
    order_sql,
    order_sql
  )
  using
    topic_id, resource_type, resource_language, resource_price, resource_level,
    word_queries, word_texts, alt_word_texts,
    any_word_query, query_text, alt_text,
    (after_cursor ->> 'p')::timestamptz,
    (after_cursor ->> 'i')::uuid,
    (after_cursor ->> 's')::double precision,
    (after_cursor ->> 'r')::double precision,
    (after_cursor ->> 'c')::integer,
    row_limit,
    row_offset;
end;
$$;

revoke execute on function public.search_resources(
  text, text, uuid, public.resource_type, public.resource_language, public.resource_price, public.resource_level,
  text, jsonb, integer
) from public;
grant execute on function public.search_resources(
  text, text, uuid, public.resource_type, public.resource_language, public.resource_price, public.resource_level,
  text, jsonb, integer
) to anon, authenticated, service_role;

revoke execute on all functions in schema private from public;
