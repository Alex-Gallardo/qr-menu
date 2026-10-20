import type { Entitlements } from "@/features/licensing/entitlements";
import type { Feature } from "@/features/licensing/plan-catalog";
import { AccessError } from "@/lib/errors";

/**
 * Decisión de acceso como función pura: rol, sucursal, licencia y funciones.
 * requireAccess (servidor) carga los datos y llama a esta función.
 */

export type MemberRole = "owner" | "manager";

export type Membership = {
  memberId: string;
  businessId: string;
  role: MemberRole;
  /** true = todas las sucursales (siempre para el dueño). */
  allBranches: boolean;
  /** Sucursales asignadas cuando allBranches es false. */
  branchIds: string[];
};

export type AccessOptions = {
  /** Roles permitidos. Por defecto, dueño y encargado. */
  roles?: MemberRole[];
  /** Sucursal sobre la que se actúa. */
  branchId?: string;
  /** Función de la licencia que la acción necesita. */
  feature?: Feature;
  /** La acción escribe (bloqueada si la licencia está suspendida). */
  write?: boolean;
};

const FEATURE_NAMES: Partial<Record<Feature, string>> = {
  scheduling: "la programación por franjas",
  branch_scheduling: "la programación por sucursal",
  multi_branch: "varias sucursales",
  preorders: "los pedidos fuera de horario",
  all_templates: "todas las plantillas",
  custom_palette: "la paleta personalizada",
  image_bg: "los fondos con imagen",
  video_bg: "los fondos con video",
  custom_splash: "la bienvenida personalizada",
  staff_pin: "el staff con PIN",
  analytics_full: "las analíticas completas",
  analytics_compare: "la comparación entre sucursales",
  remove_branding: "quitar la marca del pie",
};

export function canSeeBranch(member: Membership, branchId: string) {
  return member.role === "owner" || member.allBranches || member.branchIds.includes(branchId);
}

/** Sucursales visibles para el miembro dentro de las del negocio. */
export function visibleBranchIds(member: Membership, businessBranchIds: string[]) {
  return businessBranchIds.filter((id) => canSeeBranch(member, id));
}

/** Lanza AccessError si no se permite; si se permite, no hace nada. */
export function assertAccess(
  member: Membership | null,
  entitlements: Entitlements,
  options: AccessOptions = {},
) {
  if (!member) {
    throw new AccessError("forbidden", "No tienes acceso a este negocio.");
  }
  if (!entitlements.panelAccess) {
    throw new AccessError(
      "license_inactive",
      "La cuenta de este negocio está cancelada. Escríbenos si quieres reactivarla.",
    );
  }
  if (options.roles && !options.roles.includes(member.role)) {
    throw new AccessError("role_forbidden", "Esta opción la maneja el dueño del negocio.");
  }
  if (options.branchId && !canSeeBranch(member, options.branchId)) {
    throw new AccessError("branch_forbidden", "No tienes acceso a esa sucursal.");
  }
  if (options.write && entitlements.readOnly) {
    throw new AccessError(
      "read_only",
      "Tu cuenta está en pausa: puedes ver todo, pero no hacer cambios. Escríbenos para reactivarla.",
    );
  }
  if (options.feature && !entitlements.features.includes(options.feature)) {
    const name = FEATURE_NAMES[options.feature] ?? "esta función";
    throw new AccessError(
      "feature_unavailable",
      `Tu plan no incluye ${name}. Mejora tu plan para usarlo.`,
    );
  }
}
