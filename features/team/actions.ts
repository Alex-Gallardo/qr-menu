"use server";

import { headers } from "next/headers";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { getAuthUser, getProfile } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { emailEnabled, sendEmail } from "@/lib/email";
import { AccessError } from "@/lib/errors";
import { buildInviteEmail } from "./email";
import {
  acceptInviteSchema,
  invitationIdSchema,
  inviteSchema,
  memberBranchesSchema,
  memberIdSchema,
  staffActiveSchema,
  staffCreateSchema,
  staffPinSchema,
} from "./schemas";
import {
  acceptInvitation,
  changeStaffPin,
  createStaff,
  inviteManager,
  removeMember,
  renewInvitation,
  revokeInvitation,
  setMemberBranches,
  setStaffActive,
  staffBranch,
} from "./server";
import { branchesLabel, INVITE_TTL_DAYS, invitePath } from "./team";

function firstIssue(error: { issues: { message: string }[] }) {
  return { ok: false as const, message: error.issues[0]?.message ?? "Revisa los datos." };
}

/** Origen de la petición (localhost, preview o producción) para el link. */
async function origin() {
  const h = await headers();
  return h.get("origin") ?? BRAND.url;
}

/** Manda el correo si está activo; si falla, el dueño igual tiene el link para compartir. */
async function emailInvite(input: {
  businessId: string;
  email: string;
  link: string;
  inviterId: string;
}) {
  if (!emailEnabled()) return false;
  try {
    const [business, inviter, invitation] = await Promise.all([
      db().businesses.findUnique({
        where: { id: input.businessId },
        select: {
          name: true,
          email: true,
          branches: { select: { id: true, name: true } },
        },
      }),
      getProfile(input.inviterId),
      db().business_invitations.findFirst({
        where: {
          business_id: input.businessId,
          email: input.email,
          accepted_at: null,
          revoked_at: null,
        },
        orderBy: { created_at: "desc" },
        select: { all_branches: true, branch_ids: true },
      }),
    ]);
    if (!business || !invitation) return false;
    const mail = buildInviteEmail({
      businessName: business.name,
      inviterName: inviter?.full_name ?? null,
      branches: branchesLabel(invitation.all_branches, invitation.branch_ids, business.branches),
      link: input.link,
      brandName: BRAND.name,
      days: INVITE_TTL_DAYS,
    });
    await sendEmail({ to: input.email, fromName: business.name, replyTo: business.email, ...mail });
    return true;
  } catch (error) {
    console.error("[team] No se pudo enviar la invitación:", error);
    return false;
  }
}

/** Invitar encargado (solo el dueño). Devuelve el link para compartirlo también por WhatsApp. */
export async function inviteManagerAction(
  input: unknown,
): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requireAccess(parsed.data.businessId, { roles: ["owner"], write: true });
    const { token } = await inviteManager(parsed.data, { actorId: user.id });
    const link = new URL(invitePath(token), await origin()).toString();
    const emailed = await emailInvite({
      businessId: parsed.data.businessId,
      email: parsed.data.email,
      link,
      inviterId: user.id,
    });
    return {
      ok: true,
      message: emailed
        ? `Le enviamos la invitación a ${parsed.data.email}.`
        : "Invitación lista: comparte el link.",
      data: { link, emailed },
    };
  } catch (error) {
    return actionError(error);
  }
}

/** Reenviar (link nuevo y 7 días más). */
export async function renewInvitationAction(
  input: unknown,
): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  const parsed = invitationIdSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, invitationId } = parsed.data;
  try {
    const { user } = await requireAccess(businessId, { roles: ["owner"], write: true });
    const { token, email } = await renewInvitation(businessId, invitationId, { actorId: user.id });
    const link = new URL(invitePath(token), await origin()).toString();
    const emailed = await emailInvite({ businessId, email, link, inviterId: user.id });
    return {
      ok: true,
      message: emailed
        ? `Reenviamos la invitación a ${email}.`
        : "Link nuevo listo para compartir.",
      data: { link, emailed },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeInvitationAction(input: unknown): Promise<ActionResult> {
  const parsed = invitationIdSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, invitationId } = parsed.data;
  try {
    const { user } = await requireAccess(businessId, { roles: ["owner"], write: true });
    await revokeInvitation(businessId, invitationId, { actorId: user.id });
    return { ok: true, message: "Cancelamos la invitación." };
  } catch (error) {
    return actionError(error);
  }
}

export async function setMemberBranchesAction(input: unknown): Promise<ActionResult> {
  const parsed = memberBranchesSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requireAccess(parsed.data.businessId, { roles: ["owner"], write: true });
    await setMemberBranches(parsed.data, { actorId: user.id });
    return { ok: true, message: "Guardamos sus sucursales." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeMemberAction(input: unknown): Promise<ActionResult> {
  const parsed = memberIdSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, memberId } = parsed.data;
  try {
    const { user } = await requireAccess(businessId, { roles: ["owner"], write: true });
    await removeMember(businessId, memberId, { actorId: user.id });
    return { ok: true, message: "Ya no tiene acceso a tu negocio." };
  } catch (error) {
    return actionError(error);
  }
}

/** Aceptar la invitación con la sesión actual (correo invitado). */
export async function acceptInvitationAction(
  input: unknown,
): Promise<ActionResult<{ businessId: string }>> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Esta invitación no es válida." };
  try {
    const user = await getAuthUser();
    if (!user || user.isAnonymous)
      throw new AccessError("unauthenticated", "Entra con tu cuenta para aceptar la invitación.");
    const { businessId } = await acceptInvitation(parsed.data.token, {
      id: user.id,
      email: user.email ?? null,
    });
    return { ok: true, message: "¡Bienvenido al equipo!", data: { businessId } };
  } catch (error) {
    return actionError(error);
  }
}

/** Staff con PIN: el dueño, o el encargado en sus sucursales. */
export async function createStaffAction(input: unknown): Promise<ActionResult> {
  const parsed = staffCreateSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, branchId } = parsed.data;
  try {
    const { user } = await requireAccess(businessId, {
      branchId,
      feature: "staff_pin",
      write: true,
    });
    await createStaff(parsed.data, { actorId: user.id });
    return { ok: true, message: `Listo: ${parsed.data.name} ya puede entrar con su PIN.` };
  } catch (error) {
    return actionError(error);
  }
}

async function staffAccess(businessId: string, staffId: string) {
  const branchId = await staffBranch(businessId, staffId);
  if (!branchId) throw new AccessError("forbidden", "Esa persona ya no está en el staff.");
  return requireAccess(businessId, { branchId, feature: "staff_pin", write: true });
}

export async function changeStaffPinAction(input: unknown): Promise<ActionResult> {
  const parsed = staffPinSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, staffId, pin } = parsed.data;
  try {
    const { user } = await staffAccess(businessId, staffId);
    await changeStaffPin(businessId, staffId, pin, { actorId: user.id });
    return { ok: true, message: "PIN cambiado." };
  } catch (error) {
    return actionError(error);
  }
}

export async function setStaffActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = staffActiveSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, staffId, active } = parsed.data;
  try {
    const { user } = await staffAccess(businessId, staffId);
    await setStaffActive(businessId, staffId, active, { actorId: user.id });
    return {
      ok: true,
      message: active
        ? "Puede volver a entrar con su PIN."
        : "Desactivado: su PIN ya no abre turno.",
    };
  } catch (error) {
    return actionError(error);
  }
}
