import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { IMPERSONATION_COOKIE } from "@/features/admin/businesses";
import { announcementApplies } from "@/features/admin/admin";
import { can } from "@/features/admin/permissions";
import { hasPendingPayment } from "@/features/billing/server";
import { getEntitlements } from "@/features/licensing/server";
import { visibleBranchIds } from "@/lib/auth/access";
import { getMembership } from "@/lib/auth/require-access";
import { getProfile, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { branchCookieName, resolveBranchSelection } from "./branch-selection";
import { isOwnerOnly, panelHref } from "./nav";

export type PanelBranch = { id: string; name: string; slug: string; isActive: boolean };

/**
 * Todo lo que el layout y las páginas del panel necesitan, en una lectura por
 * request: usuario, membresía, negocio, sucursales visibles, sucursal elegida y
 * licencia. Sin membresía → 404 (no se revela que el negocio existe).
 */
export const getPanelContext = cache(async (businessId: string) => {
  const user = await requireUser(panelHref(businessId, ""));
  let member = await getMembership(user.id, businessId);
  // Soporte de la plataforma "dentro" del negocio: ve como el dueño, solo lectura
  // (las acciones exigen membresía real, así que nada se puede cambiar).
  const impersonating = !member && (await canImpersonate(user, businessId));
  if (impersonating)
    member = { memberId: "soporte", businessId, role: "owner", allBranches: true, branchIds: [] };
  if (!member) notFound();

  const [business, branches, entitlements, profile, cookieStore, pendingPayment] =
    await Promise.all([
      db().businesses.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, slug: true, logo_url: true },
      }),
      db().branches.findMany({
        where: { business_id: businessId, hidden_by_license: false },
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
        select: { id: true, name: true, slug: true, is_active: true },
      }),
      getEntitlements(businessId),
      getProfile(user.id),
      cookies(),
      // Boleta en verificación (aviso del panel; solo le importa al dueño).
      member.role === "owner" && !impersonating ? hasPendingPayment(businessId) : false,
    ]);
  if (!business) notFound();
  // Anuncios del super admin para este negocio (todos, su plan o solo él).
  const announcements = (
    await db().announcements.findMany({
      where: {
        is_active: true,
        audience: { in: ["all", `plan:${entitlements.planId}`, `business:${businessId}`] },
      },
      orderBy: { starts_at: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        body: true,
        audience: true,
        starts_at: true,
        ends_at: true,
        is_active: true,
      },
    })
  )
    .filter((a) => announcementApplies(a, { id: businessId, planId: entitlements.planId }))
    .map((a) => ({ id: a.id, title: a.title, body: a.body }));

  const visibleIds = visibleBranchIds(
    member,
    branches.map((b) => b.id),
  );
  const visibleBranches: PanelBranch[] = branches
    .filter((b) => visibleIds.includes(b.id))
    .map((b) => ({ id: b.id, name: b.name, slug: b.slug, isActive: b.is_active }));

  const selectedBranch = resolveBranchSelection({
    role: member.role,
    visibleBranchIds: visibleIds,
    saved: cookieStore.get(branchCookieName(businessId))?.value,
  });

  return {
    user: { id: user.id, email: user.email, name: profile?.full_name ?? null },
    member,
    business,
    branches: visibleBranches,
    selectedBranch,
    entitlements: impersonating ? { ...entitlements, readOnly: true } : entitlements,
    pendingPayment,
    impersonating,
    announcements,
  };
});

export type PanelContext = Awaited<ReturnType<typeof getPanelContext>>;

/** Equipo de la plataforma con 2FA, permiso de soporte y la cookie de este negocio. */
async function canImpersonate(user: { id: string; aal: string }, businessId: string) {
  const store = await cookies();
  if (store.get(IMPERSONATION_COOKIE)?.value !== businessId || user.aal !== "aal2") return false;
  const profile = await getProfile(user.id);
  return can(profile?.platform_role, "businesses.impersonate");
}

/** Para páginas exclusivas del dueño: el encargado recibe 404, igual que la navegación. */
export async function requireOwnerPage(businessId: string, segment: string) {
  const ctx = await getPanelContext(businessId);
  if (isOwnerOnly(segment) && ctx.member.role !== "owner") notFound();
  return ctx;
}
