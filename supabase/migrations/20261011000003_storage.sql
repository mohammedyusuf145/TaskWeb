-- ============================================================================
--  Mizan · 0003 · Private storage bucket for card attachments
--  Path layout: <user_id>/<card_id>/<file_id>-<name>
--  Limits: 20 MB per file; PDFs, images, Office documents and plain text only.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  20971520,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'text/plain', 'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "attachments: read own"   on storage.objects;
drop policy if exists "attachments: upload own" on storage.objects;
drop policy if exists "attachments: update own" on storage.objects;
drop policy if exists "attachments: delete own" on storage.objects;

create policy "attachments: read own" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "attachments: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "attachments: update own" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "attachments: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
