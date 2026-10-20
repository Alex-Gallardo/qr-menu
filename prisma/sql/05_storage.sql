-- Storage: bucket 'media' público para lectura; escritura solo de dueños y
-- encargados dentro de la carpeta de su negocio: {business_id}/…

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 6291456,
  array['image/webp', 'image/jpeg', 'image/png', 'image/avif', 'image/svg+xml', 'video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Carpeta raíz del objeto como uuid, o null si no es un uuid válido.
create or replace function public.storage_business_id(object_name text)
returns uuid
language plpgsql immutable
as $$
begin
  return ((storage.foldername(object_name))[1])::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists "miembros suben archivos" on storage.objects;
create policy "miembros suben archivos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_member(public.storage_business_id(name), array['owner', 'manager'])
  );

drop policy if exists "miembros actualizan archivos" on storage.objects;
create policy "miembros actualizan archivos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and public.is_member(public.storage_business_id(name), array['owner', 'manager'])
  );

drop policy if exists "miembros borran archivos" on storage.objects;
create policy "miembros borran archivos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and public.is_member(public.storage_business_id(name), array['owner', 'manager'])
  );
