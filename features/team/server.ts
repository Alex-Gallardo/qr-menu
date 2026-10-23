import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { assertWithinLimit } from "@/features/licensing/server";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { inviteExpiry, inviteState, normalizeEmail, PIN_TAKEN } from "./team";
import type { InviteInput, StaffCreateInput } from "./schemas";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(24).toString("base64url");

type Ctx = { actorId: string };

/** Correos de los usuarios (viven en auth.users; profiles no los guarda). */
async function emailsOf(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();
  const rows = await db().$queryRaw<{ id: string; email: string | null }[]>`
    SELECT id::text AS id, email FROM auth.users WHERE id = ANY(${userIds}::uuid[])`;
  return new Map(rows.filter((r) => r.email).map((r) => [r.id, r.email!]));
}

async function userIdByEmail(email: string) {
  const rows = await db().$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM auth.users WHERE lower(email) = ${normalizeEmail(email)} LIMIT 1`;
  return rows[0]?.id ?? null;
}

/** Solo sucursales de este negocio (un id ajeno se ignora). */
async function ownBranchIds(businessId: string, branchIds: string[]) {
  if (branchIds.length === 0) return [];
  const rows = await db().branches.findMany({
    where: { business_id: businessId, id: { in: branchIds } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Encargados e invitaciones (solo para el dueño). */
export async function listManagers(businessId: string) {
  const [members, invitations] = await Promise.all([
    db().business_members.findMany({
      where: { business_id: businessId, role: "manager" },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        user_id: true,
        all_branches: true,
        created_at: true,
        user: { select: { full_name: true } },
        branches: { select: { branch_id: true } },
      },
    }),
    db().business_invitations.findMany({
      where: { business_id: businessId, accepted_at: null, revoked_at: null },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        email: true,
        all_branches: true,
        branch_ids: true,
        expires_at: true,
        created_at: true,
      },
    }),
  ]);
  const emails = await emailsOf(members.map((m) => m.user_id));
  return {
    managers: members.map((m) => ({
      memberId: m.id,
      name: m.user.full_name,
      email: emails.get(m.user_id) ?? null,
      allBranches: m.all_branches,
      branchIds: m.branches.map((b) => b.branch_id),
      since: m.created_at,
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      allBranches: i.all_branches,
      branchIds: i.branch_ids,
      expiresAt: i.expires_at,
      expired: inviteState({ ...i, accepted_at: null, revoked_at: null }) === "expired",
    })),
  };
}

/**
 * Invitar encargado: dentro del límite del plan (contando las pendientes),
 * sin duplicar a alguien que ya está en el equipo. Una invitación nueva al
 * mismo correo reemplaza la anterior. Devuelve el token (va solo en el link).
 */
export async function inviteManager(input: InviteInput, { actorId }: Ctx) {
  const { businessId } = input;
  const email = normalizeEmail(input.email);
  const pending = await db().business_invitations.findMany({
    where: {
      business_id: businessId,
      accepted_at: null,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    select: { id: true, email: true },
  });
  const others = pending.filter((p) => p.email !== email).length;
  await assertWithinLimit(businessId, "managers", 1 + others);

  const existingUser = await userIdByEmail(email);
  if (existingUser) {
    const member = await db().business_members.findUnique({
      where: { business_id_user_id: { business_id: businessId, user_id: existingUser } },
      select: { role: true },
    });
    if (member)
      throw new AppError(
        "already_member",
        member.role === "owner"
          ? "Ese correo es el del dueño."
          : "Esa persona ya está en tu equipo.",
      );
  }
  const branchIds = input.allBranches ? [] : await ownBranchIds(businessId, input.branchIds);
  if (!input.allBranches && branchIds.length === 0)
    throw new AppError("validation", "Elige al menos una sucursal.");

  const token = newToken();
  const invitation = await db().$transaction(async (tx) => {
    await tx.business_invitations.updateMany({
      where: { business_id: businessId, email, accepted_at: null, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return tx.business_invitations.create({
      data: {
        business_id: businessId,
        email,
        all_branches: input.allBranches,
        branch_ids: branchIds,
        token_hash: hashToken(token),
        invited_by: actorId,
        expires_at: inviteExpiry(),
      },
      select: { id: true },
    });
  });
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "team.invite",
    entity: "business_invitations",
    entityId: invitation.id,
    diff: { email, all_branches: input.allBranches, branches: branchIds.length },
  });
  return { invitationId: invitation.id, token };
}

/** Reenviar: link nuevo (el anterior deja de servir) y 7 días más. */
export async function renewInvitation(businessId: string, invitationId: string, { actorId }: Ctx) {
  const inv = await db().business_invitations.findFirst({
    where: { id: invitationId, business_id: businessId, accepted_at: null, revoked_at: null },
    select: { id: true, email: true },
  });
  if (!inv) throw new AppError("not_found", "Esa invitación ya no está pendiente.");
  const token = newToken();
  await db().business_invitations.update({
    where: { id: inv.id },
    data: { token_hash: hashToken(token), expires_at: inviteExpiry() },
  });
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "team.invite_renew",
    entity: "business_invitations",
    entityId: inv.id,
  });
  return { token, email: inv.email };
}

export async function revokeInvitation(businessId: string, invitationId: string, { actorId }: Ctx) {
  const { count } = await db().business_invitations.updateMany({
    where: { id: invitationId, business_id: businessId, accepted_at: null, revoked_at: null },
    data: { revoked_at: new Date() },
  });
  if (count === 0) throw new AppError("not_found", "Esa invitación ya no está pendiente.");
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "team.invite_revoke",
    entity: "business_invitations",
    entityId: invitationId,
  });
}

/** Invitación por su token (página /invitacion/…); null si no existe. */
export async function getInvitation(token: string) {
  const inv = await db().business_invitations.findUnique({
    where: { token_hash: hashToken(token) },
    select: {
      id: true,
      business_id: true,
      email: true,
      all_branches: true,
      branch_ids: true,
      expires_at: true,
      accepted_at: true,
      revoked_at: true,
      business: {
        select: {
          name: true,
          logo_url: true,
          branches: {
            select: { id: true, name: true },
            orderBy: [{ sort: "asc" }, { created_at: "asc" }],
          },
        },
      },
    },
  });
  if (!inv) return null;
  return { ...inv, state: inviteState(inv) };
}

/**
 * Aceptar: el usuario debe haber entrado con el correo invitado. Crea la
 * membresía de encargado con sus sucursales (o no hace nada si ya estaba).
 */
export async function acceptInvitation(token: string, user: { id: string; email: string | null }) {
  const inv = await getInvitation(token);
  if (!inv) throw new AppError("not_found", "Esta invitación no existe.");
  if (inv.state === "revoked") throw new AppError("revoked", "Esta invitación se canceló.");
  if (inv.state === "expired")
    throw new AppError("expired", "Esta invitación venció. Pide al dueño que te la reenvíe.");
  if (inv.state === "accepted") return { businessId: inv.business_id };
  if (!user.email || normalizeEmail(user.email) !== inv.email)
    throw new AppError(
      "wrong_email",
      `Esta invitación es para ${inv.email}. Entra con ese correo para aceptarla.`,
    );

  const existing = await db().business_members.findUnique({
    where: { business_id_user_id: { business_id: inv.business_id, user_id: user.id } },
    select: { id: true },
  });
  const branchIds = inv.all_branches ? [] : await ownBranchIds(inv.business_id, inv.branch_ids);
  await db().$transaction(async (tx) => {
    if (!existing) {
      await tx.business_members.create({
        data: {
          business_id: inv.business_id,
          user_id: user.id,
          role: "manager",
          all_branches: inv.all_branches,
          branches: { create: branchIds.map((branch_id) => ({ branch_id })) },
        },
      });
    }
    await tx.business_invitations.update({
      where: { id: inv.id },
      data: { accepted_at: new Date(), accepted_by: user.id },
    });
  });
  await audit({
    actorId: user.id,
    actorKind: "user",
    businessId: inv.business_id,
    action: "team.join",
    entity: "business_invitations",
    entityId: inv.id,
    diff: { email: inv.email },
  });
  return { businessId: inv.business_id };
}

async function managerOf(businessId: string, memberId: string) {
  const member = await db().business_members.findFirst({
    where: { id: memberId, business_id: businessId },
    select: { id: true, role: true, user_id: true },
  });
  if (!member) throw new AppError("not_found", "Esa persona ya no está en tu equipo.");
  if (member.role === "owner")
    throw new AppError("forbidden", "El dueño no se puede cambiar aquí.");
  return member;
}

/** Sucursales de un encargado (todas o una lista). */
export async function setMemberBranches(
  input: { businessId: string; memberId: string; allBranches: boolean; branchIds: string[] },
  { actorId }: Ctx,
) {
  const member = await managerOf(input.businessId, input.memberId);
  const branchIds = input.allBranches ? [] : await ownBranchIds(input.businessId, input.branchIds);
  if (!input.allBranches && branchIds.length === 0)
    throw new AppError("validation", "Elige al menos una sucursal.");
  await db().$transaction([
    db().business_members.update({
      where: { id: member.id },
      data: { all_branches: input.allBranches },
    }),
    db().member_branches.deleteMany({ where: { member_id: member.id } }),
    db().member_branches.createMany({
      data: branchIds.map((branch_id) => ({ member_id: member.id, branch_id })),
    }),
  ]);
  await audit({
    actorId,
    actorKind: "user",
    businessId: input.businessId,
    action: "team.branches",
    entity: "business_members",
    entityId: member.id,
    diff: { all_branches: input.allBranches, branches: branchIds.length },
  });
}

/** Quitar a un encargado: pierde el acceso y deja de recibir avisos de este negocio. */
export async function removeMember(businessId: string, memberId: string, { actorId }: Ctx) {
  const member = await managerOf(businessId, memberId);
  await db().$transaction([
    db().push_subscriptions.deleteMany({
      where: { business_id: businessId, user_id: member.user_id },
    }),
    db().business_members.delete({ where: { id: member.id } }),
  ]);
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "team.remove",
    entity: "business_members",
    entityId: member.id,
  });
}

/** ¿El PIN ya lo usa otra persona activa de la sucursal? */
async function pinTaken(branchId: string, pin: string, exceptId?: string) {
  const others = await db().staff_members.findMany({
    where: { branch_id: branchId, is_active: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { pin_hash: true },
  });
  for (const o of others) if (await bcrypt.compare(pin, o.pin_hash)) return true;
  return false;
}

/** Sucursal de un staff (para validar el acceso del encargado). */
export async function staffBranch(businessId: string, staffId: string) {
  const s = await db().staff_members.findFirst({
    where: { id: staffId, business_id: businessId },
    select: { branch_id: true },
  });
  return s?.branch_id ?? null;
}

export async function createStaff(input: StaffCreateInput, { actorId }: Ctx) {
  const { businessId, branchId } = input;
  const branch = await db().branches.findFirst({
    where: { id: branchId, business_id: businessId },
    select: { id: true },
  });
  if (!branch) throw new AppError("branch_forbidden", "No tienes acceso a esa sucursal.");
  await assertWithinLimit(businessId, "staff");
  if (await pinTaken(branchId, input.pin)) throw new AppError("pin_taken", PIN_TAKEN);
  const staff = await db().staff_members.create({
    data: {
      business_id: businessId,
      branch_id: branchId,
      display_name: input.name,
      pin_hash: await bcrypt.hash(input.pin, 10),
    },
    select: { id: true },
  });
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "staff.create",
    entity: "staff_members",
    entityId: staff.id,
    diff: { name: input.name, branch_id: branchId },
  });
  return staff;
}

/** Cambiar el PIN: también quita un bloqueo por intentos fallidos. */
export async function changeStaffPin(
  businessId: string,
  staffId: string,
  pin: string,
  { actorId }: Ctx,
) {
  const branchId = await staffBranch(businessId, staffId);
  if (!branchId) throw new AppError("not_found", "Esa persona ya no está en el staff.");
  if (await pinTaken(branchId, pin, staffId)) throw new AppError("pin_taken", PIN_TAKEN);
  await db().staff_members.update({
    where: { id: staffId },
    data: { pin_hash: await bcrypt.hash(pin, 10), failed_attempts: 0, locked_until: null },
  });
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "staff.pin_reset",
    entity: "staff_members",
    entityId: staffId,
  });
}

/** Desactivar cierra sus turnos abiertos; activar vuelve a contar en el límite. */
export async function setStaffActive(
  businessId: string,
  staffId: string,
  active: boolean,
  { actorId }: Ctx,
) {
  const staff = await db().staff_members.findFirst({
    where: { id: staffId, business_id: businessId },
    select: { id: true, is_active: true, branch_id: true },
  });
  if (!staff) throw new AppError("not_found", "Esa persona ya no está en el staff.");
  if (staff.is_active === active) return;
  if (active) await assertWithinLimit(businessId, "staff");
  await db().$transaction([
    db().staff_members.update({ where: { id: staffId }, data: { is_active: active } }),
    ...(active
      ? []
      : [
          db().staff_sessions.updateMany({
            where: { staff_member_id: staffId, ended_at: null },
            data: { ended_at: new Date() },
          }),
        ]),
  ]);
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: active ? "staff.activate" : "staff.deactivate",
    entity: "staff_members",
    entityId: staffId,
  });
}

/** Staff de unas sucursales (las que ve quien mira), con su estado de bloqueo. */
export async function listStaff(branchIds: string[]) {
  const rows = await db().staff_members.findMany({
    where: { branch_id: { in: branchIds }, hidden_by_license: false },
    orderBy: [{ is_active: "desc" }, { display_name: "asc" }],
    select: {
      id: true,
      display_name: true,
      is_active: true,
      last_login_at: true,
      branch_id: true,
      branch: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.display_name,
    active: r.is_active,
    lastLoginAt: r.last_login_at,
    branchId: r.branch_id,
    branchName: r.branch.name,
  }));
}
