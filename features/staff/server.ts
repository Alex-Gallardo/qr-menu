import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { hasFeature } from "@/features/licensing/entitlements";
import { getEntitlements } from "@/features/licensing/server";
import { db } from "@/lib/db";
import { isValidPin, lockMessage, lockState, wrongPinMessage } from "./pin";

/**
 * Staff con PIN. Un dueño o encargado autoriza la tablet de la sucursal (se
 * guarda una cookie httpOnly con un token; en la base solo su hash). En esa
 * tablet el staff escribe su PIN: si coincide con alguien de esa sucursal, se
 * abre un turno de 12 h con una sesión anónima de Supabase vinculada en
 * staff_sessions (RLS: can_see_branch). 5 fallos bloquean el dispositivo 5 min.
 */

export const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newDeviceToken = () => randomBytes(32).toString("base64url");
const failuresKey = (deviceId: string) => `pin:device:${deviceId}`;

export async function authorizeDevice(input: {
  businessId: string;
  branchId: string;
  name: string;
  approvedBy: string;
}) {
  const token = newDeviceToken();
  const device = await db().staff_devices.create({
    data: {
      business_id: input.businessId,
      branch_id: input.branchId,
      name: input.name.trim(),
      token_hash: hashToken(token),
      approved_by: input.approvedBy,
    },
    select: { id: true },
  });
  return { token, deviceId: device.id };
}

/** Dispositivo vigente (no revocado) a partir del token de su cookie. */
export async function deviceFromToken(token: string | undefined | null) {
  if (!token || token.length > 200) return null;
  return db().staff_devices.findFirst({
    where: { token_hash: hashToken(token), revoked_at: null },
    select: {
      id: true,
      name: true,
      business_id: true,
      branch_id: true,
      business: { select: { name: true, slug: true, logo_url: true } },
      branch: { select: { name: true, hidden_by_license: true } },
    },
  });
}

export type StaffDevice = NonNullable<Awaited<ReturnType<typeof deviceFromToken>>>;

async function readFailures(deviceId: string) {
  const rows = await db().$queryRaw<{ count: number; window_start: Date; db_now: Date }[]>`
    SELECT count, window_start, now() AS db_now FROM rate_limits WHERE key = ${failuresKey(deviceId)}`;
  return rows[0] ?? null;
}

/** Un fallo más (con la hora de la base). Reinicia si el bloqueo ya pasó o los fallos son viejos. */
async function recordFailure(deviceId: string) {
  const rows = await db().$queryRaw<{ count: number; window_start: Date; db_now: Date }[]>`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${failuresKey(deviceId)}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN (rate_limits.count >= 5 AND rate_limits.window_start <= now() - interval '5 minutes')
          OR (rate_limits.count < 5 AND rate_limits.window_start <= now() - interval '15 minutes')
        THEN 1 ELSE rate_limits.count + 1 END,
      window_start = now()
    RETURNING count, window_start, now() AS db_now`;
  return rows[0]!;
}

export type PinResult =
  | { ok: true; staff: { id: string; name: string }; device: StaffDevice }
  | { ok: false; message: string };

/**
 * ¿Este PIN abre un turno en este dispositivo? Solo compara contra el staff
 * activo de la sucursal del dispositivo: en otro dispositivo o sucursal no sirve.
 */
export async function verifyStaffPin(
  token: string | undefined | null,
  pin: string,
): Promise<PinResult> {
  const device = await deviceFromToken(token);
  if (!device || device.branch.hidden_by_license)
    return {
      ok: false,
      message: "Este dispositivo no está autorizado. Pide al dueño o encargado que lo autorice.",
    };
  if (!isValidPin(pin)) return { ok: false, message: "El PIN tiene de 4 a 6 dígitos." };

  const entitlements = await getEntitlements(device.business_id);
  if (!entitlements.menuOnline || !hasFeature(entitlements, "staff_pin"))
    return {
      ok: false,
      message: "El staff con PIN no está disponible en el plan de este negocio.",
    };

  const failures = await readFailures(device.id);
  const before = lockState(
    failures && { count: failures.count, windowStart: failures.window_start },
    failures?.db_now ?? new Date(),
  );
  if (before.locked) return { ok: false, message: lockMessage(before.retryAfterSec) };

  const candidates = await db().staff_members.findMany({
    where: { branch_id: device.branch_id, is_active: true, hidden_by_license: false },
    select: { id: true, display_name: true, pin_hash: true },
  });
  for (const member of candidates) {
    if (await bcrypt.compare(pin, member.pin_hash)) {
      await Promise.all([
        db().rate_limits.deleteMany({ where: { key: failuresKey(device.id) } }),
        db()
          .$executeRaw`UPDATE staff_members SET last_login_at = now(), failed_attempts = 0 WHERE id = ${member.id}::uuid`,
        db()
          .$executeRaw`UPDATE staff_devices SET last_seen_at = now() WHERE id = ${device.id}::uuid`,
      ]);
      return { ok: true, staff: { id: member.id, name: member.display_name }, device };
    }
  }

  const after = await recordFailure(device.id);
  const state = lockState({ count: after.count, windowStart: after.window_start }, after.db_now);
  return {
    ok: false,
    message: state.locked ? lockMessage(state.retryAfterSec) : wrongPinMessage(state.remaining),
  };
}

/** Abre el turno (12 h) para la sesión anónima recién creada en este dispositivo. */
export async function startStaffSession(authUserId: string, staffId: string, device: StaffDevice) {
  await db().$executeRaw`
    INSERT INTO staff_sessions (auth_user_id, staff_member_id, device_id, business_id, branch_id, expires_at)
    VALUES (${authUserId}::uuid, ${staffId}::uuid, ${device.id}::uuid, ${device.business_id}::uuid,
            ${device.branch_id}::uuid, now() + interval '12 hours')`;
}

/**
 * Turno vigente de esta sesión anónima, y solo en el dispositivo que lo abrió
 * (que además siga autorizado). null = hay que volver al teclado.
 */
export async function getStaffSession(authUserId: string, token: string | undefined | null) {
  if (!token) return null;
  const rows = await db().$queryRaw<{ id: string }[]>`
    SELECT s.id FROM staff_sessions s
    JOIN staff_devices d ON d.id = s.device_id
    JOIN staff_members m ON m.id = s.staff_member_id
    WHERE s.auth_user_id = ${authUserId}::uuid
      AND s.ended_at IS NULL AND s.expires_at > now()
      AND d.revoked_at IS NULL AND d.token_hash = ${hashToken(token)}
      AND m.is_active AND NOT m.hidden_by_license
    LIMIT 1`;
  if (!rows[0]) return null;
  return db().staff_sessions.findUnique({
    where: { id: rows[0].id },
    select: {
      id: true,
      business_id: true,
      branch_id: true,
      expires_at: true,
      staff: { select: { id: true, display_name: true } },
      branch: { select: { name: true } },
      business: { select: { name: true, logo_url: true } },
    },
  });
}

export type StaffSession = NonNullable<Awaited<ReturnType<typeof getStaffSession>>>;

export async function endStaffSession(authUserId: string) {
  await db().$executeRaw`
    UPDATE staff_sessions SET ended_at = now() WHERE auth_user_id = ${authUserId}::uuid AND ended_at IS NULL`;
}

/** Revocar: el dispositivo vuelve a pedir autorización y sus turnos abiertos terminan. */
export async function revokeDevice(businessId: string, deviceId: string) {
  return db().$transaction([
    db().$executeRaw`
      UPDATE staff_devices SET revoked_at = now()
      WHERE id = ${deviceId}::uuid AND business_id = ${businessId}::uuid AND revoked_at IS NULL`,
    db().$executeRaw`
      UPDATE staff_sessions SET ended_at = now() WHERE device_id = ${deviceId}::uuid AND ended_at IS NULL`,
  ]);
}

export async function listStaffAndDevices(branchIds: string[]) {
  const [devices, staff] = await Promise.all([
    db().staff_devices.findMany({
      where: { branch_id: { in: branchIds }, revoked_at: null },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        last_seen_at: true,
        created_at: true,
        branch: { select: { id: true, name: true } },
      },
    }),
    db().staff_members.findMany({
      where: { branch_id: { in: branchIds }, hidden_by_license: false },
      orderBy: { display_name: "asc" },
      select: {
        id: true,
        display_name: true,
        is_active: true,
        last_login_at: true,
        branch: { select: { name: true } },
      },
    }),
  ]);
  return { devices, staff };
}

/** Negocios y sucursales donde este usuario puede autorizar una tablet. */
export async function authorizableBranches(userId: string) {
  const members = await db().business_members.findMany({
    where: { user_id: userId },
    select: {
      role: true,
      all_branches: true,
      branches: { select: { branch_id: true } },
      business: {
        select: {
          id: true,
          name: true,
          branches: {
            where: { hidden_by_license: false },
            orderBy: [{ sort: "asc" }, { created_at: "asc" }],
            select: { id: true, name: true },
          },
        },
      },
    },
  });
  return members
    .map((m) => ({
      businessId: m.business.id,
      businessName: m.business.name,
      branches: m.business.branches.filter(
        (b) => m.role === "owner" || m.all_branches || m.branches.some((x) => x.branch_id === b.id),
      ),
    }))
    .filter((b) => b.branches.length > 0);
}
