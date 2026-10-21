import "server-only";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { dateOnly, todayInGuatemala } from "@/lib/gt-time";
import { gridFromRules, isWeeklyRule, rulesFromGrid, type Grid } from "./grid";
import type { OverrideOutput } from "./schemas";
import { listSlots } from "./server";

type Ctx = { actorId: string };

/** Lo que necesita la pantalla de programación, en una sola lectura. */
export async function getScheduleData(businessId: string) {
  const today = todayInGuatemala();
  const [slots, menus, rules, overrides] = await Promise.all([
    listSlots(businessId),
    db().menus.findMany({
      where: { business_id: businessId },
      orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
      select: { id: true, name: true, is_active: true, is_default: true, hidden_by_license: true },
    }),
    db().menu_schedules.findMany({
      where: { menu: { business_id: businessId } },
      select: {
        menu_id: true,
        time_slot_id: true,
        branch_id: true,
        weekdays: true,
        priority: true,
        starts_on: true,
        ends_on: true,
      },
    }),
    db().menu_overrides.findMany({
      where: { business_id: businessId, date: { gte: new Date(`${today}T00:00:00Z`) } },
      orderBy: [{ date: "asc" }],
      select: {
        id: true,
        branch_id: true,
        date: true,
        time_slot_id: true,
        menu_id: true,
        note: true,
      },
    }),
  ]);
  return {
    today,
    slots,
    menus,
    rules,
    /** Reglas con rango de fechas: no se editan en la cuadrícula, se muestran como aviso. */
    seasonalCount: rules.filter((r) => !isWeeklyRule(r)).length,
    overrides: overrides.map((o) => ({ ...o, date: dateOnly(o.date) })),
  };
}

export type ScheduleData = Awaited<ReturnType<typeof getScheduleData>>;
export type OverrideRow = ScheduleData["overrides"][number];

async function assertBranch(businessId: string, branchId: string | null) {
  if (!branchId) return;
  const branch = await db().branches.findFirst({
    where: { id: branchId, business_id: businessId },
    select: { id: true },
  });
  if (!branch) throw new AppError("not_found", "Esa sucursal ya no existe.");
}

/**
 * Guarda la cuadrícula de un alcance: reemplaza sus reglas semanales en una
 * transacción. Las reglas con rango de fechas (temporadas) no se tocan.
 */
export async function saveScheduleGrid(
  businessId: string,
  branchId: string | null,
  cells: Grid,
  ctx: Ctx,
) {
  await assertBranch(businessId, branchId);
  const rows = rulesFromGrid(cells, branchId);
  const [slots, menus] = await Promise.all([
    db().time_slots.findMany({
      where: { business_id: businessId, id: { in: [...new Set(rows.map((r) => r.time_slot_id))] } },
      select: { id: true },
    }),
    db().menus.findMany({
      where: { business_id: businessId, id: { in: [...new Set(rows.map((r) => r.menu_id))] } },
      select: { id: true },
    }),
  ]);
  const slotIds = new Set(slots.map((s) => s.id));
  const menuIds = new Set(menus.map((m) => m.id));
  if (rows.some((r) => !slotIds.has(r.time_slot_id) || !menuIds.has(r.menu_id))) {
    throw new AppError("not_found", "Una franja o un menú ya no existe. Recarga la página.");
  }

  const before = await db().menu_schedules.findMany({
    where: {
      branch_id: branchId,
      menu: { business_id: businessId },
      starts_on: null,
      ends_on: null,
    },
    select: { menu_id: true, time_slot_id: true, branch_id: true, weekdays: true, priority: true },
  });
  await db().$transaction([
    db().menu_schedules.deleteMany({
      where: {
        branch_id: branchId,
        menu: { business_id: businessId },
        starts_on: null,
        ends_on: null,
      },
    }),
    db().menu_schedules.createMany({ data: rows }),
  ]);

  // Una entrada de auditoría por guardado solo si cambió algo (el autoguardado repite).
  const changed =
    JSON.stringify(gridFromRules(before, branchId)) !==
    JSON.stringify(gridFromRules(rows, branchId));
  if (changed) {
    await audit({
      actorId: ctx.actorId,
      actorKind: "user",
      businessId,
      action: "schedule.update",
      entity: "menu_schedules",
      entityId: branchId,
      diff: { branch_id: branchId, cells: Object.keys(cells).length, rules: rows.length },
    });
  }
}

/** Fecha especial: reemplaza la que ya hubiera para el mismo alcance, día y franja. */
export async function upsertOverride(input: OverrideOutput, ctx: Ctx) {
  const { businessId, branchId, date, slotId, menuId, note } = input;
  if (date < todayInGuatemala()) {
    throw new AppError("past_date", "Esa fecha ya pasó. Elige hoy o un día futuro.");
  }
  await assertBranch(businessId, branchId);
  if (slotId) {
    const slot = await db().time_slots.findFirst({
      where: { id: slotId, business_id: businessId },
      select: { id: true },
    });
    if (!slot) throw new AppError("not_found", "Esa franja ya no existe.");
  }
  if (menuId) {
    const menu = await db().menus.findFirst({
      where: { id: menuId, business_id: businessId },
      select: { id: true },
    });
    if (!menu) throw new AppError("not_found", "Ese menú ya no existe.");
  }

  const day = new Date(`${date}T00:00:00Z`);
  const [, created] = await db().$transaction([
    db().menu_overrides.deleteMany({
      where: { business_id: businessId, branch_id: branchId, date: day, time_slot_id: slotId },
    }),
    db().menu_overrides.create({
      data: {
        business_id: businessId,
        branch_id: branchId,
        date: day,
        time_slot_id: slotId,
        menu_id: menuId,
        note,
      },
      select: { id: true },
    }),
  ]);
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "schedule.override",
    entity: "menu_overrides",
    entityId: created.id,
    diff: { branch_id: branchId, date, time_slot_id: slotId, menu_id: menuId, note },
  });
  return created;
}

/** Borra una fecha especial y devuelve sus datos para "Deshacer" (se vuelve a crear). */
export async function deleteOverride(businessId: string, overrideId: string, ctx: Ctx) {
  const row = await db().menu_overrides.findFirst({
    where: { id: overrideId, business_id: businessId },
    select: { branch_id: true, date: true, time_slot_id: true, menu_id: true, note: true },
  });
  if (!row) throw new AppError("not_found", "Esa fecha especial ya no existe.");
  await db().menu_overrides.delete({ where: { id: overrideId } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "schedule.override_delete",
    entity: "menu_overrides",
    entityId: overrideId,
    diff: { ...row, date: dateOnly(row.date) },
  });
  return { ...row, date: dateOnly(row.date) };
}

/** Sucursal de una fecha especial (para revisar permisos antes de borrarla). */
export async function overrideBranch(businessId: string, overrideId: string) {
  const row = await db().menu_overrides.findFirst({
    where: { id: overrideId, business_id: businessId },
    select: { branch_id: true },
  });
  if (!row) throw new AppError("not_found", "Esa fecha especial ya no existe.");
  return row.branch_id;
}
