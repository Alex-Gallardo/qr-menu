import type { MemberRole } from "@/lib/auth/access";

/** "all" = todas las sucursales (solo el dueño). */
export type BranchSelection = string | "all";

export const ALL_BRANCHES = "all";

export function branchCookieName(businessId: string) {
  return `qrm_branch_${businessId}`;
}

/**
 * Sucursal elegida en el selector, validada contra lo que el usuario puede ver.
 * Por defecto: el dueño con varias sucursales ve "Todas"; si no, la primera visible.
 */
export function resolveBranchSelection(input: {
  role: MemberRole;
  visibleBranchIds: string[];
  saved: string | undefined;
}): BranchSelection | null {
  const { role, visibleBranchIds, saved } = input;
  if (visibleBranchIds.length === 0) return null;

  const canSeeAll = role === "owner" && visibleBranchIds.length > 1;
  if (saved === ALL_BRANCHES && canSeeAll) return ALL_BRANCHES;
  if (saved && visibleBranchIds.includes(saved)) return saved;
  return canSeeAll ? ALL_BRANCHES : visibleBranchIds[0]!;
}
