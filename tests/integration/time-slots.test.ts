import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { slotFormSchema, type SlotFormInput } from "@/features/schedule/schemas";
import {
  createSlot,
  deleteSlot,
  listSlots,
  restoreSlot,
  setSlotActive,
  updateSlot,
} from "@/features/schedule/server";
import { LimitExceededError } from "@/lib/errors";
import { db } from "@/lib/db";

/** QRM-016: Desayuno, Almuerzo y Cena editables; sin choques; deshacer con su programación. */

const SLUG = "zz-test-qrm016";
const FREE_SLUG = "zz-test-qrm016-gratis";
let businessId: string;
let branchId: string;
let menuId: string;
let ctx: { actorId: string };

const input = (over: Partial<SlotFormInput>, biz = businessId) =>
  slotFormSchema.parse({
    businessId: biz,
    key: "custom",
    name: "Franja",
    start_time: "06:30",
    end_time: "11:00",
    is_active: true,
    ...over,
  });

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, FREE_SLUG] } } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-016",
      branches: { create: { slug: "centro", name: "Centro", whatsapp_e164: "+50255550000" } },
      menus: { create: { name: "Menú del día" } },
      license: {
        create: {
          plan_id: "pro",
          status: "active",
          ends_at: new Date(Date.now() + 30 * 86_400_000),
        },
      },
    },
    select: { id: true, branches: { select: { id: true } }, menus: { select: { id: true } } },
  });
  businessId = biz.id;
  branchId = biz.branches[0]!.id;
  menuId = biz.menus[0]!.id;
  const owner = await db().business_members.findFirst({ where: { role: "owner" } });
  if (!owner) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  ctx = { actorId: owner.user_id };
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, FREE_SLUG] } } });
  await db().$disconnect();
});

describe("franjas horarias", () => {
  it("crea Desayuno, Almuerzo y Cena y las devuelve en orden del día", async () => {
    await createSlot(
      input({ key: "dinner", name: "Cena", start_time: "17:30", end_time: "21:30" }),
      ctx,
    );
    await createSlot(
      input({ key: "breakfast", name: "Desayuno", start_time: "06:30", end_time: "11:00" }),
      ctx,
    );
    await createSlot(
      input({ key: "lunch", name: "Almuerzo", start_time: "11:30", end_time: "15:30" }),
      ctx,
    );

    const slots = await listSlots(businessId);
    expect(slots.map((s) => s.name)).toEqual(["Desayuno", "Almuerzo", "Cena"]);
    const sorts = await db().time_slots.findMany({
      where: { business_id: businessId },
      orderBy: { sort: "asc" },
      select: { name: true },
    });
    expect(sorts.map((s) => s.name)).toEqual(["Desayuno", "Almuerzo", "Cena"]);
  });

  it("son editables: renombrar y cambiar el horario", async () => {
    const lunch = (await listSlots(businessId)).find((s) => s.key === "lunch")!;
    await updateSlot(
      {
        ...input({ ...lunch, name: "Almuerzos", start_time: "12:00", end_time: "16:00" }),
        slotId: lunch.id,
      },
      ctx,
    );
    const after = (await listSlots(businessId)).find((s) => s.id === lunch.id)!;
    expect(after).toMatchObject({ name: "Almuerzos", start_time: "12:00", end_time: "16:00" });
  });

  it("no permite choques ni un segundo Desayuno", async () => {
    await expect(
      createSlot(input({ name: "Brunch", start_time: "10:00", end_time: "12:30" }), ctx),
    ).rejects.toThrow(/Se cruza con “Desayuno”/);
    await expect(
      createSlot(
        input({ key: "breakfast", name: "Desayuno 2", start_time: "04:00", end_time: "05:00" }),
        ctx,
      ),
    ).rejects.toThrow(/Ya tienes una franja de Desayuno/);
  });

  it("acepta una franja que cruza la medianoche y la pausada no bloquea", async () => {
    await createSlot(input({ name: "Noche", start_time: "22:00", end_time: "02:00" }), ctx);
    const noche = (await listSlots(businessId)).find((s) => s.name === "Noche")!;
    await setSlotActive(businessId, noche.id, false, ctx);
    // Pausada, una franja que la pisa sí se puede crear…
    await createSlot(input({ name: "Madrugada", start_time: "01:00", end_time: "04:00" }), ctx);
    // …pero reactivarla ya no.
    await expect(setSlotActive(businessId, noche.id, true, ctx)).rejects.toThrow(/Se cruza con/);
  });

  it("borrar y deshacer devuelve la franja con su programación y fechas especiales", async () => {
    const dinner = (await listSlots(businessId)).find((s) => s.key === "dinner")!;
    await db().menu_schedules.create({
      data: {
        menu_id: menuId,
        time_slot_id: dinner.id,
        branch_id: branchId,
        weekdays: [1, 2, 3],
        priority: 5,
      },
    });
    await db().menu_overrides.create({
      data: {
        business_id: businessId,
        branch_id: branchId,
        date: new Date("2026-12-24"),
        time_slot_id: dinner.id,
        menu_id: null,
        note: "Cerrado en Nochebuena",
      },
    });

    const removed = await deleteSlot(businessId, dinner.id, ctx);
    expect(removed).toEqual({ name: "Cena", schedules: 1 });
    expect(await db().menu_schedules.count({ where: { time_slot_id: dinner.id } })).toBe(0);

    await restoreSlot(businessId, dinner.id, ctx);
    const back = await db().time_slots.findUniqueOrThrow({
      where: { id: dinner.id },
      include: { schedules: true, overrides: true },
    });
    expect(back).toMatchObject({ name: "Cena", start_time: "17:30", end_time: "21:30" });
    expect(back.schedules).toMatchObject([
      { menu_id: menuId, branch_id: branchId, weekdays: [1, 2, 3], priority: 5 },
    ]);
    expect(back.overrides).toMatchObject([{ note: "Cerrado en Nochebuena", menu_id: null }]);
    expect(back.overrides[0]!.date.toISOString().slice(0, 10)).toBe("2026-12-24");

    // Deshacer dos veces no duplica nada.
    await restoreSlot(businessId, dinner.id, ctx);
    expect(await db().menu_schedules.count({ where: { time_slot_id: dinner.id } })).toBe(1);
  });

  it("no restaura si mientras tanto otra franja ocupa ese horario", async () => {
    const created = await createSlot(
      input({ name: "Merienda", start_time: "16:00", end_time: "17:00" }),
      ctx,
    );
    await deleteSlot(businessId, created.id, ctx);
    await createSlot(
      input({ name: "Café de la tarde", start_time: "16:00", end_time: "17:00" }),
      ctx,
    );
    await expect(restoreSlot(businessId, created.id, ctx)).rejects.toThrow(/Se cruza con/);
  });

  it("deshacer solo con el id de un borrado de este negocio", async () => {
    await expect(
      restoreSlot(businessId, "11111111-2222-4333-8444-555555555555", ctx),
    ).rejects.toThrow(/Ya no se puede deshacer/);
  });

  it("el plan Gratis permite una sola franja", async () => {
    const free = await db().businesses.create({
      data: { slug: FREE_SLUG, name: "Gratis" },
      select: { id: true },
    });
    await createSlot(
      input({ name: "Todo el día", start_time: "07:00", end_time: "20:00" }, free.id),
      ctx,
    );
    await expect(
      createSlot(input({ name: "Noche", start_time: "21:00", end_time: "23:00" }, free.id), ctx),
    ).rejects.toThrow(LimitExceededError);
  });
});
