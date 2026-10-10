-- Storage: public avatars bucket. Files live under "<user id>/", so each user manages only their own.
-- No SVG (it can carry scripts); 1 MiB is plenty for a resized avatar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public URLs of a public bucket need no policy. These policies cover uploads, upserts (which also
-- need select) and deletes through the Storage API.
create policy "Users can read their own avatar files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Active users can upload their avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_user())
  );

create policy "Active users can replace their avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_user())
  );

create policy "Active users can delete their avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_user())
  );
