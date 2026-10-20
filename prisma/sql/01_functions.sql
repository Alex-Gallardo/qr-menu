-- Funciones de autorización usadas por las políticas RLS (Realtime y Storage).
-- SECURITY DEFINER: leen tablas con RLS sin exponerlas al cliente.

-- ¿El usuario actual (email o staff con PIN) puede ver esta sucursal?
create or replace function public.can_see_branch(bid uuid, brid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from business_members m
    left join member_branches mb on mb.member_id = m.id
    where m.business_id = bid
      and m.user_id = auth.uid()
      and (m.role = 'owner' or m.all_branches or mb.branch_id = brid)
  ) or exists (
    select 1
    from staff_sessions s
    where s.auth_user_id = auth.uid()
      and s.business_id = bid
      and s.branch_id = brid
      and s.ended_at is null
      and s.expires_at > now()
  );
$$;

-- ¿Es miembro (dueño o encargado) del negocio? roles = null acepta cualquiera.
create or replace function public.is_member(bid uuid, roles text[] default null)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from business_members m
    where m.business_id = bid
      and m.user_id = auth.uid()
      and (roles is null or m.role::text = any (roles))
  );
$$;

-- ¿Es parte del equipo de la plataforma? roles = null acepta admin, support y sales.
create or replace function public.is_platform(roles text[] default null)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.platform_role <> 'none'
      and (roles is null or p.platform_role::text = any (roles))
  );
$$;

-- Solo usuarios autenticados las necesitan.
revoke execute on function public.can_see_branch(uuid, uuid) from public, anon;
revoke execute on function public.is_member(uuid, text[]) from public, anon;
revoke execute on function public.is_platform(text[]) from public, anon;
grant execute on function public.can_see_branch(uuid, uuid) to authenticated;
grant execute on function public.is_member(uuid, text[]) to authenticated;
grant execute on function public.is_platform(text[]) to authenticated;
