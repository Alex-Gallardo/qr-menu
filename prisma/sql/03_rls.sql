-- RLS en TODAS las tablas de public (incluida _prisma_migrations).
-- Prisma se conecta como dueño de las tablas y no pasa por RLS: en el servidor
-- la protección es requireAccess. RLS protege lo que el navegador toca directo
-- con la llave pública: Realtime (pedidos) y Storage. Sin política = sin acceso.

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- Pedidos: la bandeja en tiempo real del dueño, encargado o staff de la sucursal.
drop policy if exists "ver pedidos de mi sucursal" on public.orders;
create policy "ver pedidos de mi sucursal" on public.orders
  for select to authenticated
  using (public.can_see_branch(business_id, branch_id));

drop policy if exists "ver cambios de estado de mi sucursal" on public.order_status_events;
create policy "ver cambios de estado de mi sucursal" on public.order_status_events
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and public.can_see_branch(o.business_id, o.branch_id)
    )
  );
