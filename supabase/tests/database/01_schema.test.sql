-- Schema-wide guarantees: RLS everywhere, no writes for guests, system columns closed to clients,
-- reference data present. Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select is(
  (select array_agg(c.relname order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'Row Level Security is enabled on every public table'
);

select is(
  (select array_agg(c.relname order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)),
  null,
  'every public table has at least one policy'
);

select is(
  (select array_agg(c.relname order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (has_any_column_privilege('anon', c.oid, 'INSERT')
       or has_any_column_privilege('anon', c.oid, 'UPDATE')
       or has_table_privilege('anon', c.oid, 'DELETE')
       or has_table_privilege('anon', c.oid, 'TRUNCATE'))),
  null,
  'guests (anon) cannot write to any public table'
);

select is(
  (select array_agg(c.relname order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'TRUNCATE')),
  null,
  'signed-in users cannot truncate any table'
);

select ok(
  not has_column_privilege('authenticated', 'public.resources', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.resources', 'author_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.resources', 'likes_count', 'INSERT'),
  'clients cannot choose status, author or counters when creating a resource'
);

select ok(
  not has_column_privilege('authenticated', 'public.resources', 'likes_count', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.resources', 'ratings_sum', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.resources', 'popularity_score', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.resources', 'author_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.resources', 'slug', 'UPDATE'),
  'clients cannot update counters, score, author or slug of a resource'
);

select ok(
  not has_column_privilege('authenticated', 'public.resource_ratings', 'counts_in_average', 'INSERT')
  and not has_column_privilege('authenticated', 'public.resource_ratings', 'counts_in_average', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.resource_ratings', 'resource_id', 'UPDATE'),
  'clients cannot decide whether their rating counts'
);

select ok(
  not has_column_privilege('authenticated', 'public.reports', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.reports', 'handled_by', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.reports', 'target_owner_id', 'INSERT'),
  'clients cannot set report status, handler or owner on insert'
);

select ok(
  not has_any_column_privilege('authenticated', 'public.audit_log', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.audit_log', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.audit_log', 'DELETE'),
  'the audit log is append-only and written by triggers only'
);

select ok(
  not has_function_privilege('anon', 'private.handle_new_user()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.refresh_popularity_scores()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.log_moderation()', 'EXECUTE'),
  'internal functions are not executable by clients'
);

select is(
  (select count(*)::integer from public.topics),
  12,
  'the 12 starting topics are seeded'
);

select is(
  (select name_uz from public.topics where slug = 'malumotlar-tahlili'),
  'Maʼlumotlar tahlili',
  'topic names use the Uzbek tutuq belgisi (U+02BC)'
);

select ok(
  exists (select 1 from public.blocked_domains where domain = 'bit.ly'),
  'URL shorteners are blocked by default'
);

select is(
  (select schedule from cron.job where jobname = 'refresh-popularity-scores'),
  '0 21 * * *',
  'popularity scores are refreshed daily'
);

select * from finish();
rollback;
