-- Topics: the categories every resource belongs to. Managed by admins.

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name_uz text not null,
  name_ru text,
  name_en text,
  description_uz text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint topics_slug_key unique (slug),
  constraint topics_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  constraint topics_name_uz_length check (char_length(btrim(name_uz)) between 2 and 60),
  constraint topics_name_ru_length check (char_length(btrim(name_ru)) between 2 and 60),
  constraint topics_name_en_length check (char_length(btrim(name_en)) between 2 and 60),
  constraint topics_description_uz_length check (char_length(description_uz) <= 300)
);

create index topics_sort_order_idx on public.topics (sort_order, name_uz);

revoke all on table public.topics from anon, authenticated;
grant select on table public.topics to anon, authenticated;
grant insert (slug, name_uz, name_ru, name_en, description_uz, sort_order),
  update (slug, name_uz, name_ru, name_en, description_uz, sort_order),
  delete
  on table public.topics to authenticated;

alter table public.topics enable row level security;

create policy "Topics are public"
  on public.topics for select
  to anon, authenticated
  using (true);

create policy "Admins can create topics"
  on public.topics for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "Admins can update topics"
  on public.topics for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Topics that still have resources cannot be deleted (foreign key `on delete restrict`).
create policy "Admins can delete topics"
  on public.topics for delete
  to authenticated
  using ((select private.is_admin()));
