import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { assertWithinLimit } from "@/features/licensing/server";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { isScannableCode, menuPath, newShortCode, qrKind, tableRange, type QrKind } from "./codes";
import type { CreateQrInput } from "./schemas";

const SELECT = {
  id: true,
  branch_id: true,
  label: true,
  short_code: true,
  table_label: true,
  style: true,
  scans: true,
  created_at: true,
} as const;

export type QrRow = {
  id: string;
  branchId: string;
  label: string;
  code: string;
  table: string | null;
  kind: QrKind;
  scans: number;
};

/** QR visibles del negocio (o de unas sucursales): sucursal, luego mesas en orden numérico, luego campañas. */
export async function listQrCodes(businessId: string, branchIds: string[]): Promise<QrRow[]> {
  const rows = await db().qr_codes.findMany({
    where: { business_id: businessId, branch_id: { in: branchIds }, hidden_by_license: false },
    orderBy: { created_at: "asc" },
    select: SELECT,
  });
  const order: Record<QrKind, number> = { branch: 0, table: 1, campaign: 2 };
  return rows
    .map((r) => ({
      id: r.id,
      branchId: r.branch_id,
      label: r.label,
      code: r.short_code,
      table: r.table_label,
      kind: qrKind(r),
      scans: r.scans,
    }))
    .sort(
      (a, b) =>
        order[a.kind] - order[b.kind] ||
        (a.kind === "table"
          ? Number(a.table) - Number(b.table) || a.table!.localeCompare(b.table!)
          : 0),
    );
}

async function assertBranch(businessId: string, branchId: string) {
  const branch = await db().branches.findFirst({
    where: { id: branchId, business_id: businessId },
    select: { id: true },
  });
  if (!branch) throw new AppError("branch_forbidden", "No tienes acceso a esa sucursal.");
}

const code = () => newShortCode((n) => new Uint8Array(randomBytes(n)));

/**
 * Crea los QR pedidos (respeta el límite del plan). Las mesas que ya tienen
 * QR en esa sucursal se saltan: no hay dos QR para la misma mesa.
 */
export async function createQrCodes(
  input: CreateQrInput,
  { actorId }: { actorId: string },
): Promise<{ created: number; skipped: number }> {
  const { businessId, branchId } = input;
  await assertBranch(businessId, branchId);

  let wanted: { label: string; table_label: string | null; style: Prisma.InputJsonValue }[];
  if (input.kind === "branch") {
    // Sin mesa y sin "campaign" es el de la sucursal (los viejos no tienen style).
    const general = await db().qr_codes.findMany({
      where: { business_id: businessId, branch_id: branchId, table_label: null },
      select: { table_label: true, style: true },
    });
    if (general.some((r) => qrKind(r) === "branch"))
      throw new AppError("qr_exists", "Esta sucursal ya tiene su QR.");
    wanted = [{ label: "Sucursal", table_label: null, style: { kind: "branch" } }];
  } else if (input.kind === "table") {
    const tables = tableRange(input.from, input.to);
    if (!tables) throw new AppError("validation", "Revisa el rango de mesas.");
    const taken = new Set(
      (
        await db().qr_codes.findMany({
          where: { business_id: businessId, branch_id: branchId, table_label: { in: tables } },
          select: { table_label: true },
        })
      ).map((r) => r.table_label),
    );
    wanted = tables
      .filter((t) => !taken.has(t))
      .map((t) => ({ label: `Mesa ${t}`, table_label: t, style: { kind: "table" } }));
  } else {
    wanted = [{ label: input.label, table_label: null, style: { kind: "campaign" } }];
  }

  const skipped = input.kind === "table" ? input.to - input.from + 1 - wanted.length : 0;
  if (wanted.length === 0) return { created: 0, skipped };
  await assertWithinLimit(businessId, "qr", wanted.length);

  // El código es único en toda la plataforma; con 56^7 combinaciones un choque es rarísimo.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db().qr_codes.createMany({
        data: wanted.map((w) => ({
          business_id: businessId,
          branch_id: branchId,
          short_code: code(),
          ...w,
        })),
      });
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002" || attempt === 2) throw error;
    }
  }

  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "qr.create",
    entity: "qr_codes",
    diff: { branch_id: branchId, labels: wanted.map((w) => w.label) },
  });
  return { created: wanted.length, skipped };
}

/** Borra un QR y devuelve lo necesario para deshacerlo (mismo código y escaneos). */
export async function deleteQrCode(
  businessId: string,
  qrId: string,
  { actorId }: { actorId: string },
) {
  const row = await db().qr_codes.findFirst({
    where: { id: qrId, business_id: businessId },
    select: { ...SELECT, branch_id: true },
  });
  if (!row) throw new AppError("not_found", "Ese QR ya no existe.");
  await db().qr_codes.delete({ where: { id: row.id } });
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "qr.delete",
    entity: "qr_codes",
    entityId: row.id,
    diff: { label: row.label, short_code: row.short_code },
  });
  return {
    branch_id: row.branch_id,
    label: row.label,
    short_code: row.short_code,
    table_label: row.table_label,
    style: (row.style as { kind: QrKind } | null) ?? null,
    scans: row.scans,
  };
}

export async function restoreQrCode(
  businessId: string,
  qr: Awaited<ReturnType<typeof deleteQrCode>>,
) {
  if (!isScannableCode(qr.short_code)) throw new AppError("validation", "No pudimos deshacer.");
  await assertBranch(businessId, qr.branch_id);
  await assertWithinLimit(businessId, "qr", 1);
  await db().qr_codes.create({
    data: { business_id: businessId, ...qr, style: qr.style ?? undefined },
  });
}

/**
 * Escaneo: a dónde lleva el código y, si es una persona (no una vista
 * previa de enlace), suma el escaneo y lo registra para analíticas.
 * null si el código no existe.
 */
export async function resolveScan(shortCode: string, { count }: { count: boolean }) {
  if (!isScannableCode(shortCode)) return null;
  const qr = await db().qr_codes.findUnique({
    where: { short_code: shortCode },
    select: {
      id: true,
      business_id: true,
      branch_id: true,
      table_label: true,
      business: { select: { slug: true } },
      branch: { select: { slug: true } },
    },
  });
  if (!qr) return null;
  if (count) {
    // Suma atómica en la base (dos escaneos a la vez no se pisan).
    await db().$transaction([
      db().qr_codes.update({ where: { id: qr.id }, data: { scans: { increment: 1 } } }),
      db().analytics_events.create({
        data: {
          business_id: qr.business_id,
          branch_id: qr.branch_id,
          event: "qr_scan",
          session_id: randomUUID(),
          qr_code_id: qr.id,
        },
      }),
    ]);
  }
  return menuPath(qr.business.slug, qr.branch.slug, qr.table_label);
}
