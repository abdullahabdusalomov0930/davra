-- "Obunalarim": search_resources can list only resources from the people and topics the visitor
-- follows (DECISIONS.md D49). Same function as in 20261010170000_search.sql plus `following_only`;
-- a new parameter changes the signature, so the old function is dropped first.

drop function public.search_resources(
  text, text, uuid, public.resource_type, public.resource_language, public.resource_price, public.resource_level,
  text, jsonb, integer
);

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
  page_size integer default 20,
  following_only boolean default false
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
  follow_sql text := 'true';
  viewer_id uuid := (select auth.uid());
begin
  if sort_mode not in ('relevance', 'newest', 'popular', 'top') then
    raise exception 'unknown sort: %', sort_mode using errcode = '22023';
  end if;

  if coalesce(following_only, false) then
    -- Guests follow nobody.
    if viewer_id is null then
      return;
    end if;
    follow_sql := '(exists (select 1 from public.follows_users f where f.follower_id = $19 and f.followed_id = r.author_id)
      or exists (select 1 from public.follows_topics f where f.user_id = $19 and f.topic_id = r.topic_id))';
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
         and %s
       order by %s
       limit $17 offset $18
     ) s
     order by %s',
    cursor_sql,
    relevance_sql,
    match_sql,
    keyset_sql,
    follow_sql,
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
    row_offset,
    viewer_id;
end;
$$;

revoke execute on function public.search_resources(
  text, text, uuid, public.resource_type, public.resource_language, public.resource_price, public.resource_level,
  text, jsonb, integer, boolean
) from public;
grant execute on function public.search_resources(
  text, text, uuid, public.resource_type, public.resource_language, public.resource_price, public.resource_level,
  text, jsonb, integer, boolean
) to anon, authenticated, service_role;
