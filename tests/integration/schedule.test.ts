import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cellKey,
  effectiveCell,
  fillWeek,
  gridFromRules,
  type Grid,
} from "@/features/schedule/grid";
import {
  deleteOverride,
  getScheduleData,
  saveScheduleGrid,
  upsertOverride,
} from "@/features/schedule/program-server";
import { overrideSchema, type OverrideInput } from "@/features/schedule/schemas";
import { db } from "@/lib/db";
import { todayInGuatemala } from "@/lib/gt-time";

/** QRM-018: programación general y por sucursal; la de sucursal gana. Fechas especiales. */

const SLUG = "zz-test-qrm018";
let businessId: string;
let zona1: string;
let antigua: string;
let lunch: string;
let dinner: string;
let almuerzo: string;
let carta: string;
let ctx: { actorId: string };

const override = (over: Partial<OverrideInput>) =>
  overrideSchema.parse({
    businessId,
    branchId: null,
    date: todayInGuatemala(),
    slotId: null,
    menuId: null,
    note: "",
    ...over,
  });

const weekdaysOnly = (slotId: string, menuId: string): Grid =>
  Object.fromEntries([1, 2, 3, 4, 5].map((d) => [cellKey(slotId, d), menuId]));

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-018",
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
      menus: { create: [{ name: "Almuerzo ejecutivo" }, { name: "Carta", is_default: true }] },
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
  lunch = biz.time_slots.find((s) => s.key === "lunch")!.id;
  dinner = biz.time_slots.find((s) => s.key === "dinner")!.id;
  almuerzo = biz.menus.find((m) => m.name === "Almuerzo ejecutivo")!.id;
  carta = biz.menus.find((m) => m.name === "Carta")!.id;
  const owner = await db().business_members.findFirst({ where: { role: "owner" } });
  if (!owner) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  ctx = { actorId: owner.user_id };
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().$disconnect();
});

describe("programación semanal", () => {
  it("la regla de sucursal gana a la general", async () => {
    // General: almuerzo ejecutivo L–V y carta en la cena toda la semana.
    await saveScheduleGrid(
      businessId,
      null,
      { ...weekdaysOnly(lunch, almuerzo), ...fillWeek({}, dinner, carta) },
      ctx,
    );
    // Antigua: carta también en el almuerzo L–V.
    await saveScheduleGrid(businessId, antigua, weekdaysOnly(lunch, carta), ctx);

    const { rules } = await getScheduleData(businessId);
    const general = gridFromRules(rules, null);
    const tuesday = cellKey(lunch, 2);
    expect(effectiveCell(general, gridFromRules(rules, antigua), tuesday)).toEqual({
      menuId: carta,
      source: "branch",
    });
    expect(effectiveCell(general, gridFromRules(rules, zona1), tuesday)).toEqual({
      menuId: almuerzo,
      source: "general",
    });
    // Prioridad guardada: la de sucursal por encima de la general.
    expect(rules.find((r) => r.branch_id === antigua)!.priority).toBeGreaterThan(
      rules.find((r) => r.branch_id === null)!.priority,
    );
  });

  it("guardar la general no toca las reglas de sucursal ni las de temporada", async () => {
    await db().menu_schedules.create({
      data: {
        menu_id: carta,
        time_slot_id: lunch,
        weekdays: [6],
        starts_on: new Date("2026-12-01"),
        ends_on: new Date("2026-12-31"),
      },
    });
    await saveScheduleGrid(businessId, null, fillWeek({}, dinner, carta), ctx);

    const { rules, seasonalCount } = await getScheduleData(businessId);
    expect(seasonalCount).toBe(1);
    expect(gridFromRules(rules, antigua)).toEqual(weekdaysOnly(lunch, carta));
    expect(gridFromRules(rules, null)).toEqual(fillWeek({}, dinner, carta));
  });

  it("guarda compacto (una fila por franja y menú) y vaciar la borra", async () => {
    await saveScheduleGrid(businessId, zona1, weekdaysOnly(lunch, almuerzo), ctx);
    expect(await db().menu_schedules.count({ where: { branch_id: zona1 } })).toBe(1);
    await saveScheduleGrid(businessId, zona1, {}, ctx);
    expect(await db().menu_schedules.count({ where: { branch_id: zona1 } })).toBe(0);
  });

  it("rechaza menús o franjas de otro negocio y sucursales ajenas", async () => {
    const foreign = await db().menus.findFirst({ where: { business: { slug: "cafe-el-portal" } } });
    await expect(
      saveScheduleGrid(businessId, null, { [cellKey(lunch, 1)]: foreign!.id }, ctx),
    ).rejects.toThrow(/ya no existe/);
    const otherBranch = await db().branches.findFirst({
      where: { business: { slug: "cafe-el-portal" } },
    });
    await expect(saveScheduleGrid(businessId, otherBranch!.id, {}, ctx)).rejects.toThrow(
      /sucursal/,
    );
  });
});

describe("fechas especiales", () => {
  it("“Cerrado hoy” en una sucursal y un menú distinto para todas", async () => {
    await upsertOverride(override({ branchId: zona1, note: "Inventario" }), ctx);
    await upsertOverride(
      override({ date: "2099-12-24", slotId: dinner, menuId: carta, note: "Nochebuena" }),
      ctx,
    );
    const { overrides } = await getScheduleData(businessId);
    expect(overrides).toEqual([
      expect.objectContaining({
        branch_id: zona1,
        date: todayInGuatemala(),
        menu_id: null,
        note: "Inventario",
      }),
      expect.objectContaining({
        branch_id: null,
        date: "2099-12-24",
        time_slot_id: dinner,
        menu_id: carta,
      }),
    ]);
  });

  it("la misma fecha, alcance y franja se reemplaza (no se duplica)", async () => {
    await upsertOverride(
      override({ date: "2099-12-24", slotId: dinner, menuId: almuerzo, note: "Cambio" }),
      ctx,
    );
    const rows = await db().menu_overrides.findMany({
      where: { business_id: businessId, note: { in: ["Nochebuena", "Cambio"] } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.menu_id).toBe(almuerzo);
  });

  it("no acepta fechas pasadas y las pasadas no se listan", async () => {
    await expect(upsertOverride(override({ date: "2020-01-01" }), ctx)).rejects.toThrow(/ya pasó/);
    await db().menu_overrides.create({
      data: { business_id: businessId, date: new Date("2020-01-01") },
    });
    const { overrides } = await getScheduleData(businessId);
    expect(overrides.some((o) => o.date === "2020-01-01")).toBe(false);
  });

  it("borrar devuelve los datos para deshacer", async () => {
    const { overrides } = await getScheduleData(businessId);
    const closed = overrides.find((o) => o.branch_id === zona1)!;
    const row = await deleteOverride(businessId, closed.id, ctx);
    expect(row).toMatchObject({
      branch_id: zona1,
      menu_id: null,
      note: "Inventario",
      date: todayInGuatemala(),
    });
    await upsertOverride(
      override({ branchId: row.branch_id, date: row.date, note: row.note ?? "" }),
      ctx,
    );
    expect(
      (await getScheduleData(businessId)).overrides.filter((o) => o.branch_id === zona1),
    ).toHaveLength(1);
  });
});
