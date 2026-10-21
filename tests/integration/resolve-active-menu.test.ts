import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getResolverData } from "@/features/schedule/program-server";
import { resolveActiveMenu, resolveNextMenu } from "@/features/schedule/resolve-active-menu";
import { db } from "@/lib/db";
import { addDays, gtInstant, todayInGuatemala } from "@/lib/gt-time";

/** QRM-019: datos reales de la base → menú del día por sucursal. */

const SLUG = "zz-test-qrm019";
let businessId: string;
let zona1: string;
let antigua: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-019",
      branches: {
        create: [
          { slug: "zona-1", name: "Zona 1", whatsapp_e164: "+50255550001" },
          { slug: "antigua", name: "Antigua", whatsapp_e164: "+50255550002" },
        ],
      },
      time_slots: {
        create: [
          { key: "lunch", name: "Almuerzo", start_time: "11:30", end_time: "15:30" },
          { key: "dinner", name: "Cena", start_time: "17:30", end_time: "21:30" },
        ],
      },
      menus: { create: [{ name: "Ejecutivo" }, { name: "Carta", is_default: true }] },
    },
    select: {
      id: true,
      branches: { select: { id: true, slug: true } },
      time_slots: { select: { id: true, key: true } },
      menus: { select: { id: true, name: true } },
    },
  });
  businessId = biz.id;
  zona1 = biz.branches.find((b) => b.slug === "zona-1")!.id;
  antigua = biz.branches.find((b) => b.slug === "antigua")!.id;
  for (const s of biz.time_slots) ids[s.key] = s.id;
  for (const m of biz.menus) ids[m.name] = m.id;

  const weekdays = [1, 2, 3, 4, 5];
  await db().menu_schedules.createMany({
    data: [
      { menu_id: ids.Ejecutivo!, time_slot_id: ids.lunch!, weekdays },
      { menu_id: ids.Carta!, time_slot_id: ids.dinner!, weekdays: [0, 1, 2, 3, 4, 5, 6] },
      { menu_id: ids.Carta!, time_slot_id: ids.lunch!, branch_id: antigua, weekdays, priority: 10 },
    ],
  });
  // Hoy (en Guatemala) Zona 1 está cerrada; dentro de 10 días hay un feriado general (fuera del rango: no se carga).
  await db().menu_overrides.createMany({
    data: [
      {
        business_id: businessId,
        branch_id: zona1,
        date: new Date(`${todayInGuatemala()}T00:00:00Z`),
        note: "Inventario",
      },
      {
        business_id: businessId,
        date: new Date(`${addDays(todayInGuatemala(), 10)}T00:00:00Z`),
        note: "Lejano",
      },
    ],
  });
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().$disconnect();
});

describe("menú del día con datos de la base", () => {
  it("un martes al almuerzo: Antigua ve su carta y Zona 1 el ejecutivo", async () => {
    const data = await getResolverData(businessId);
    const tuesdayNoon = gtInstant("2026-10-20", 12 * 60);
    expect(resolveActiveMenu({ branchId: antigua, ...data }, tuesdayNoon)).toMatchObject({
      menuId: ids.Carta,
      reason: "schedule_branch",
    });
    expect(resolveActiveMenu({ branchId: zona1, ...data }, tuesdayNoon).menuId).toBe(ids.Ejecutivo);
    expect(resolveNextMenu({ branchId: zona1, ...data }, tuesdayNoon)).toMatchObject({
      menuId: ids.Carta,
      slot: { id: ids.dinner },
    });
  });

  it("“Cerrado hoy” de Zona 1 se aplica hoy solo a Zona 1", async () => {
    const data = await getResolverData(businessId);
    const today = todayInGuatemala();
    const noonToday = gtInstant(today, 12 * 60);
    expect(resolveActiveMenu({ branchId: zona1, ...data }, noonToday)).toMatchObject({
      status: "closed",
      message: "Cerrado: Inventario",
    });
    expect(resolveActiveMenu({ branchId: antigua, ...data }, noonToday).status).not.toBe("closed");
  });

  it("solo carga las fechas especiales de ayer a mañana", async () => {
    const data = await getResolverData(businessId);
    expect(data.overrides.map((o) => o.note)).toEqual(["Inventario"]);
  });
});
