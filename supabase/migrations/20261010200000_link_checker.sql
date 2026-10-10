-- Link checker (DECISIONS.md D56–D58): results are recorded by the scheduled checker through
-- record_link_check, which only trusted server code (service role) may call.

-- The checker picks published resources by how long ago they were last checked (never first).
create index resources_link_check_due_idx on public.resources (last_link_check_at nulls first)
  where status = 'published';

-- Records one check of `checked_url` for a resource:
--   ok       → link_status 'ok', failure count reset
--   failure  → one more consecutive failure; 'broken' from the second one on
--   unknown  → the site refused to answer a bot (403, 429, …): nothing learned, status kept
-- The check time is stored in every case. If the author changed the link while it was being checked,
-- the result is about the old link and is ignored (the update trigger already reset the status).
-- Returns the resulting link_status, or null when the result was ignored.
create function public.record_link_check(resource_id uuid, checked_url text, outcome text)
returns public.link_status
language plpgsql
set search_path = ''
as $$
declare
  result public.link_status;
begin
  if outcome not in ('ok', 'failure', 'unknown') then
    raise exception 'unknown outcome: %', outcome using errcode = '22023';
  end if;

  update public.resources r
  set
    last_link_check_at = now(),
    link_check_failures = case outcome
      when 'ok' then 0
      when 'failure' then least(r.link_check_failures + 1, 100)
      else r.link_check_failures
    end,
    link_status = case
      when outcome = 'ok' then 'ok'::public.link_status
      when outcome = 'failure' and r.link_check_failures + 1 >= 2 then 'broken'::public.link_status
      else r.link_status
    end
  where r.id = record_link_check.resource_id and r.url = record_link_check.checked_url
  returning r.link_status into result;

  return result;
end;
$$;

revoke execute on function public.record_link_check(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_link_check(uuid, text, text) to service_role;
