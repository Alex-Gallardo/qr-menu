import "server-only";
import { cache } from "react";
import { z } from "zod";
import { getEntitlements } from "@/features/licensing/server";
import { db } from "@/lib/db";
import { AccessError } from "@/lib/errors";
import { assertAccess, type AccessOptions, type Membership } from "./access";
import { getAuthUser } from "./session";

/** Membresía del usuario en el negocio, con sus sucursales asignadas. */
export const getMembership = cache(
  async (userId: string, businessId: string): Promise<Membership | null> => {
    if (!z.uuid().safeParse(businessId).success) return null;
    const member = await db().business_members.findUnique({
      where: { business_id_user_id: { business_id: businessId, user_id: userId } },
      select: {
        id: true,
        role: true,
        all_branches: true,
        branches: { select: { branch_id: true } },
      },
    });
    if (!member) return null;
    return {
      memberId: member.id,
      businessId,
      role: member.role,
      allBranches: member.role === "owner" || member.all_branches,
      branchIds: member.branches.map((b) => b.branch_id),
    };
  },
);

/**
 * Puerta de toda Server Action y pantalla del panel:
 * sesión → membresía → sucursal del negocio → rol → licencia → función.
 *
 *   const { user, member, entitlements } = await requireAccess(businessId, {
 *     roles: ["owner"], branchId, feature: "preorders", write: true,
 *   });
 *
 * Lanza AccessError (con mensaje para el usuario) si algo no se cumple.
 */
export async function requireAccess(businessId: string, options: AccessOptions = {}) {
  const user = await getAuthUser();
  if (!user || user.isAnonymous) {
    throw new AccessError("unauthenticated", "Tu sesión terminó. Vuelve a entrar.");
  }

  const [member, entitlements] = await Promise.all([
    getMembership(user.id, businessId),
    getEntitlements(businessId),
  ]);

  // La sucursal debe pertenecer al negocio (evita usar el id de otra cuenta).
  if (options.branchId) {
    const branch = z.uuid().safeParse(options.branchId).success
      ? await db().branches.findFirst({
          where: { id: options.branchId, business_id: businessId },
          select: { id: true },
        })
      : null;
    if (!branch) throw new AccessError("branch_forbidden", "No tienes acceso a esa sucursal.");
  }

  assertAccess(member, entitlements, options);
  return { user, member: member!, entitlements };
}
