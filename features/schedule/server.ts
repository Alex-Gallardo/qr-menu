import "server-only";
import { assertWithinLimit } from "@/features/licensing/server";
import { audit, diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { z } from "@/lib/zod";
import { slotKeySchema, type SlotFormOutput } from "./schemas";
import { findOverlap, formatSlotRange, SLOT_KEY_LABELS, sortSlots } from "./slots";

type Ctx = { actorId: string };

const SELECT = {
  id: true,
  key: true,
  name: true,
  start_time: true,
  end_time: true,
  is_active: true,
} as const;

/** Franjas del negocio en el orden del día (por hora de inicio). */
export async function listSlots(businessId: string) {
  const slots = await db().time_slots.findMany({
    where: { business_id: businessId },
    select: SELECT,
  });
  return sortSlots(slots);
}

export type SlotRow = Awaited<ReturnType<typeof listSlots>>[number];

async function getSlot(businessId: string, slotId: string) {
  const slot = await db().time_slots.findFirst({
    where: { id: slotId, business_id: businessId },
    select: SELECT,
  });
  if (!slot) throw new AppError("not_found", "Esa franja ya no existe.");
  return slot;
}

/** Reglas entre franjas: sin choques entre las activas y un solo Desayuno/Almuerzo/Cena. */
async function assertFits(businessId: string, slot: SlotFormOutput) {
  const others = await listSlots(businessId);

  if (slot.key !== "custom") {
    const same = others.find((o) => o.key === slot.key && o.id !== slot.slotId);
    if (same) {
      throw new AppError(
        "duplicate",
        `Ya tienes una franja de ${SLOT_KEY_LABELS[slot.key]} (“${same.name}”). Usa “Personalizada” para otra.`,
      );
    }
  }

  if (slot.is_active) {
    const clash = findOverlap({ ...slot, id: slot.slotId }, others);
    if (clash) {
      throw new AppError(
        "overlap",
        `Se cruza con “${clash.name}” (${formatSlotRange(clash)}). Ajusta las horas o pausa una de las dos.`,
      );
    }
  }
}

/** Sort = posición en el día, para que las consultas por `sort` salgan en orden. */
async function renumber(businessId: string) {
  const slots = await listSlots(businessId);
  await db().$transaction(
    slots.map((s, sort) => db().time_slots.update({ where: { id: s.id }, data: { sort } })),
  );
}

const data = (s: SlotFormOutput) => ({
  key: s.key,
  name: s.name,
  start_time: s.start_time,
  end_time: s.end_time,
  is_active: s.is_active,
});

export async function createSlot(input: SlotFormOutput, ctx: Ctx) {
  await assertWithinLimit(input.businessId, "time_slots");
  await assertFits(input.businessId, input);
  const slot = await db().time_slots.create({
    data: { ...data(input), business_id: input.businessId },
    select: { id: true },
  });
  await renumber(input.businessId);
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId: input.businessId,
    action: "time_slot.create",
    entity: "time_slots",
    entityId: slot.id,
    diff: { name: input.name, range: formatSlotRange(input) },
  });
  return slot;
}

export async function updateSlot(input: SlotFormOutput & { slotId: string }, ctx: Ctx) {
  const before = await getSlot(input.businessId, input.slotId);
  await assertFits(input.businessId, input);
  const after = data(input);
  await db().time_slots.update({ where: { id: input.slotId }, data: after });
  await renumber(input.businessId);
  const changes = diffFields(before, after);
  if (Object.keys(changes).length > 0) {
    await audit({
      actorId: ctx.actorId,
      actorKind: "user",
      businessId: input.businessId,
      action: "time_slot.update",
      entity: "time_slots",
      entityId: input.slotId,
      diff: changes,
    });
  }
}

/** Pausar o reactivar (al reactivar se vuelve a revisar que no choque). */
export async function setSlotActive(businessId: string, slotId: string, active: boolean, ctx: Ctx) {
  const before = await getSlot(businessId, slotId);
  if (before.is_active === active) return;
  if (active) await assertFits(businessId, { ...before, businessId, slotId, is_active: true });
  await db().time_slots.update({ where: { id: slotId }, data: { is_active: active } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "time_slot.update",
    entity: "time_slots",
    entityId: slotId,
    diff: { is_active: [before.is_active, active] },
  });
}

/** Cuánto tiempo después de borrar se puede deshacer (el toast dura 6 s). */
const UNDO_WINDOW_MS = 10 * 60 * 1000;

const snapshotSchema = z.object({
  slot: z.object({
    id: z.uuid(),
    key: slotKeySchema,
    name: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    is_active: z.boolean(),
    sort: z.number().int(),
  }),
  schedules: z.array(
    z.object({
      id: z.uuid(),
      menu_id: z.uuid(),
      branch_id: z.uuid().nullable(),
      weekdays: z.array(z.number().int()),
      starts_on: z.string().nullable(),
      ends_on: z.string().nullable(),
      priority: z.number().int(),
    }),
  ),
  overrides: z.array(
    z.object({
      id: z.uuid(),
      branch_id: z.uuid().nullable(),
      date: z.string(),
      menu_id: z.uuid().nullable(),
      note: z.string().nullable(),
    }),
  ),
});

/**
 * Borra la franja. La base borra en cascada su programación y fechas especiales;
 * la copia para "Deshacer" queda en la auditoría (escrita por el servidor), así
 * el navegador solo manda el id y no puede inyectar filas.
 */
export async function deleteSlot(businessId: string, slotId: string, ctx: Ctx) {
  const slot = await db().time_slots.findFirst({
    where: { id: slotId, business_id: businessId },
    select: {
      ...SELECT,
      sort: true,
      schedules: {
        select: {
          id: true,
          menu_id: true,
          branch_id: true,
          weekdays: true,
          starts_on: true,
          ends_on: true,
          priority: true,
        },
      },
      overrides: {
        select: { id: true, branch_id: true, date: true, menu_id: true, note: true },
      },
    },
  });
  if (!slot) throw new AppError("not_found", "Esa franja ya no existe.");
  const { schedules, overrides, ...row } = slot;
  const snapshot = JSON.parse(JSON.stringify({ slot: row, schedules, overrides }));

  await db().time_slots.delete({ where: { id: slotId } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "time_slot.delete",
    entity: "time_slots",
    entityId: slotId,
    diff: { name: slot.name, range: formatSlotRange(slot), snapshot },
  });
  return { name: slot.name, schedules: schedules.length };
}

const toDate = (iso: string | null) => (iso ? new Date(iso) : null);

/** "Deshacer": la franja con su mismo id, su programación y sus fechas especiales. */
export async function restoreSlot(businessId: string, slotId: string, ctx: Ctx) {
  const entry = await db().audit_logs.findFirst({
    where: {
      business_id: businessId,
      action: "time_slot.delete",
      entity_id: slotId,
      created_at: { gte: new Date(Date.now() - UNDO_WINDOW_MS) },
    },
    orderBy: { created_at: "desc" },
    select: { diff: true },
  });
  const parsed = snapshotSchema.safeParse((entry?.diff as { snapshot?: unknown } | null)?.snapshot);
  if (!parsed.success) throw new AppError("not_found", "Ya no se puede deshacer. Créala de nuevo.");
  if (await db().time_slots.findUnique({ where: { id: slotId }, select: { id: true } })) return;

  const { slot, schedules, overrides } = parsed.data;
  // Si mientras tanto se creó otra que choca o repite el tipo, no se restaura.
  await assertFits(businessId, { ...slot, businessId, slotId: slot.id });
  await assertWithinLimit(businessId, "time_slots");

  // Solo lo que todavía existe en el negocio (un menú o sucursal pudo borrarse).
  const [menus, branches] = await Promise.all([
    db().menus.findMany({ where: { business_id: businessId }, select: { id: true } }),
    db().branches.findMany({ where: { business_id: businessId }, select: { id: true } }),
  ]);
  const menuIds = new Set(menus.map((m) => m.id));
  const branchIds = new Set(branches.map((b) => b.id));
  const branchOk = (id: string | null) => id === null || branchIds.has(id);

  await db().$transaction([
    db().time_slots.create({ data: { ...slot, business_id: businessId } }),
    db().menu_schedules.createMany({
      data: schedules
        .filter((s) => menuIds.has(s.menu_id) && branchOk(s.branch_id))
        .map((s) => ({
          ...s,
          time_slot_id: slot.id,
          starts_on: toDate(s.starts_on),
          ends_on: toDate(s.ends_on),
        })),
    }),
    db().menu_overrides.createMany({
      data: overrides
        .filter((o) => (o.menu_id === null || menuIds.has(o.menu_id)) && branchOk(o.branch_id))
        .map((o) => ({
          ...o,
          business_id: businessId,
          time_slot_id: slot.id,
          date: new Date(o.date),
        })),
    }),
  ]);
  await renumber(businessId);
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "time_slot.restore",
    entity: "time_slots",
    entityId: slot.id,
  });
}
