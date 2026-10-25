/**
 * Equipo (guía "Equipo: personas y acceso"), puro: invitaciones de
 * encargados, a qué sucursales llegan y quién puede tocar a quién.
 */

/** Una invitación vale 7 días; se puede reenviar (nuevo link). */
export const INVITE_TTL_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export const inviteExpiry = (now: Date = new Date()) =>
  new Date(now.getTime() + INVITE_TTL_DAYS * DAY);

export type InviteState = "pending" | "expired" | "accepted" | "revoked";

export function inviteState(
  inv: { expires_at: Date; accepted_at: Date | null; revoked_at: Date | null },
  now: Date = new Date(),
): InviteState {
  if (inv.accepted_at) return "accepted";
  if (inv.revoked_at) return "revoked";
  return inv.expires_at.getTime() <= now.getTime() ? "expired" : "pending";
}

export const INVITE_STATE_LABELS: Record<InviteState, string> = {
  pending: "Pendiente",
  expired: "Venció",
  accepted: "Aceptada",
  revoked: "Cancelada",
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** /invitacion/{token}: el token va solo en el link (en la base, su hash). */
export const invitePath = (token: string) => `/invitacion/${token}`;

/** "Todas las sucursales" o "Zona 1 y Antigua". */
export function branchesLabel(
  allBranches: boolean,
  branchIds: string[],
  branches: { id: string; name: string }[],
) {
  if (allBranches) return "Todas las sucursales";
  const names = branches.filter((b) => branchIds.includes(b.id)).map((b) => b.name);
  if (names.length === 0) return "Sin sucursales";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

/** El PIN no puede repetirse en la misma sucursal (al escribirlo no se sabría de quién es). */
export const PIN_TAKEN = "Ese PIN ya lo usa otra persona de esta sucursal. Elige otro.";

/** Texto para compartir la invitación por WhatsApp (si el correo no llega o no está activo). */
export function inviteShareText(businessName: string, link: string) {
  return `Te invito a ayudarme con ${businessName} en el panel de pedidos. Entra aquí para aceptar: ${link}`;
}
