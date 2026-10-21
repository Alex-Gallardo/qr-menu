import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEntitlements } from "@/features/licensing/server";
import { menuDocumentSchema, type MenuDocumentInput } from "@/features/menus/schemas";
import {
  createMenu,
  deleteMenu,
  duplicateMenu,
  getMenuForEdit,
  listMenus,
  restoreMenu,
  saveMenuDocument,
  setDefaultMenu,
  setMenuActive,
} from "@/features/menus/server";
import { db } from "@/lib/db";
import { AppError, LimitExceededError } from "@/lib/errors";

/** QRM-017: menús con secciones e ítems, duplicar, predeterminado, borrar y deshacer. */

const SLUG = "zz-test-qrm017";
const FREE_SLUG = "zz-test-qrm017-gratis";
let businessId: string;
let branchId: string;
let slotId: string;
let products: string[];
let ctx: { actorId: string };

const doc = (menuId: string, over: Partial<MenuDocumentInput> = {}) =>
  menuDocumentSchema.parse({
    businessId,
    menuId,
    name: "Menú del día",
    description: "",
    template: "clasico",
    sections: [],
    ...over,
  });

const section = (name: string, productIds: string[], price = "") => ({
  key: name,
  name,
  description: "",
  items: productIds.map((productId, i) => ({
    key: `${name}-${i}`,
    productId,
    price: i === 0 ? price : "",
    isFeatured: i === 0,
  })),
});

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, FREE_SLUG] } } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-017",
      branches: { create: { slug: "centro", name: "Centro", whatsapp_e164: "+50255550000" } },
      time_slots: {
        create: { key: "lunch", name: "Almuerzo", start_time: "11:30", end_time: "15:30" },
      },
      license: {
        create: {
          plan_id: "pro",
          status: "active",
          ends_at: new Date(Date.now() + 30 * 86_400_000),
        },
      },
      products: {
        create: ["Pepián", "Hilachas", "Jocón", "Horchata", "Rellenitos", "Café"].map(
          (name, sort) => ({
            name,
            price_cents: 3000 + sort * 500,
            sort,
          }),
        ),
      },
    },
    select: {
      id: true,
      branches: { select: { id: true } },
      time_slots: { select: { id: true } },
      products: { orderBy: { sort: "asc" }, select: { id: true } },
    },
  });
  businessId = biz.id;
  branchId = biz.branches[0]!.id;
  slotId = biz.time_slots[0]!.id;
  products = biz.products.map((p) => p.id);
  const owner = await db().business_members.findFirst({ where: { role: "owner" } });
  if (!owner) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  ctx = { actorId: owner.user_id };
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, FREE_SLUG] } } });
  await db().$disconnect();
});

describe("menús", () => {
  it("arma un menú de 4 secciones con precio especial y destacado", async () => {
    const { id } = await createMenu(businessId, "Menú del día", ctx);
    const [a, b, c, d, e, f] = products as [string, string, string, string, string, string];
    await saveMenuDocument(
      doc(id, {
        description: "De lunes a viernes",
        sections: [
          section("Entradas", [a]),
          section("Platos fuertes", [b, c], "39.50"),
          section("Bebidas", [d, f]),
          section("Postres", [e]),
        ],
      }),
      await getEntitlements(businessId),
    );

    const menu = (await getMenuForEdit(businessId, id))!;
    expect(menu.is_default).toBe(true); // el primero queda como predeterminado
    expect(menu.sections.map((s) => [s.name, s.items.length])).toEqual([
      ["Entradas", 1],
      ["Platos fuertes", 2],
      ["Bebidas", 2],
      ["Postres", 1],
    ]);
    expect(menu.sections[1]!.items[0]).toMatchObject({
      product_id: b,
      price_override_cents: 3950,
      is_featured: true,
    });
    const row = (await listMenus(businessId)).find((m) => m.id === id)!;
    expect(row).toMatchObject({ sectionCount: 4, itemCount: 6 });
  });

  it("guardar reemplaza la estructura (reordenar y quitar)", async () => {
    const [menu] = await listMenus(businessId);
    const before = (await getMenuForEdit(businessId, menu!.id))!;
    await saveMenuDocument(
      doc(menu!.id, {
        sections: [
          section("Postres", [products[4]!]),
          section("Entradas", [products[0]!, products[0]!]), // repetido: se guarda una vez
        ],
      }),
      await getEntitlements(businessId),
    );
    const after = (await getMenuForEdit(businessId, menu!.id))!;
    expect(after.sections.map((s) => s.name)).toEqual(["Postres", "Entradas"]);
    expect(after.sections[1]!.items).toHaveLength(1);
    expect(
      await db().menu_items.count({
        where: { section_id: { in: before.sections.map((s) => s.id) } },
      }),
    ).toBe(0);
  });

  it("rechaza productos de otro negocio y plantillas fuera del plan", async () => {
    const [menu] = await listMenus(businessId);
    const foreign = await db().products.findFirst({
      where: { business: { slug: "cafe-el-portal" } },
    });
    await expect(
      saveMenuDocument(
        doc(menu!.id, { sections: [section("Ajenos", [foreign!.id])] }),
        await getEntitlements(businessId),
      ),
    ).rejects.toThrow(/ya no existe/);

    const free = await getEntitlements(businessId);
    await expect(
      saveMenuDocument(doc(menu!.id, { template: "galeria" }), { ...free, features: [] }),
    ).rejects.toThrow(/Clásico/);
  });

  it("duplica en pausa con su estructura, sin programación", async () => {
    const [menu] = await listMenus(businessId);
    await db().menu_schedules.create({
      data: { menu_id: menu!.id, time_slot_id: slotId, weekdays: [1, 2, 3, 4, 5] },
    });
    const copy = await duplicateMenu(businessId, menu!.id, ctx);
    expect(copy.name).toBe("Menú del día (copia)");
    const row = (await listMenus(businessId)).find((m) => m.id === copy.id)!;
    expect(row).toMatchObject({
      is_active: false,
      is_default: false,
      sectionCount: 2,
      scheduleCount: 0,
    });
  });

  it("predeterminado: único, siempre activo y no se puede pausar", async () => {
    const menus = await listMenus(businessId);
    const original = menus.find((m) => m.is_default)!;
    const copy = menus.find((m) => !m.is_default)!;
    await expect(setMenuActive(businessId, original.id, false, ctx)).rejects.toThrow(
      /predeterminado/,
    );

    await setDefaultMenu(businessId, copy.id, ctx);
    const after = await listMenus(businessId);
    expect(after.filter((m) => m.is_default).map((m) => m.id)).toEqual([copy.id]);
    expect(after.find((m) => m.id === copy.id)!.is_active).toBe(true);
    await setMenuActive(businessId, original.id, false, ctx);
    expect((await listMenus(businessId)).find((m) => m.id === original.id)!.is_active).toBe(false);
  });

  it("borrar y deshacer: vuelve con estructura, programación y fechas especiales", async () => {
    const menu = (await listMenus(businessId)).find((m) => m.scheduleCount > 0)!;
    await db().menu_overrides.create({
      data: {
        business_id: businessId,
        branch_id: branchId,
        date: new Date("2026-12-31"),
        menu_id: menu.id,
      },
    });

    const removed = await deleteMenu(businessId, menu.id, ctx);
    expect(removed.schedules).toBe(1);
    // La fecha especial se borra con el menú (no queda como "Cerrado").
    expect(await db().menu_overrides.count({ where: { business_id: businessId } })).toBe(0);

    await restoreMenu(businessId, menu.id, ctx);
    const back = await db().menus.findUniqueOrThrow({
      where: { id: menu.id },
      include: { sections: { include: { items: true } }, schedules: true, overrides: true },
    });
    expect(back.sections.map((s) => s.name).sort()).toEqual(["Entradas", "Postres"]);
    expect(back.schedules).toMatchObject([{ time_slot_id: slotId, weekdays: [1, 2, 3, 4, 5] }]);
    expect(back.overrides).toMatchObject([{ branch_id: branchId, menu_id: menu.id }]);
    await restoreMenu(businessId, menu.id, ctx); // dos veces no duplica
    expect(await db().menu_schedules.count({ where: { menu_id: menu.id } })).toBe(1);
  });

  it("deshacer no le quita el predeterminado al que se eligió mientras tanto", async () => {
    const def = (await listMenus(businessId)).find((m) => m.is_default)!;
    await deleteMenu(businessId, def.id, ctx);
    const other = (await listMenus(businessId))[0]!;
    await setDefaultMenu(businessId, other.id, ctx);
    await restoreMenu(businessId, def.id, ctx);
    const defaults = (await listMenus(businessId)).filter((m) => m.is_default).map((m) => m.id);
    expect(defaults).toEqual([other.id]);
  });

  it("deshacer solo funciona con un borrado real de este negocio", async () => {
    await expect(
      restoreMenu(businessId, "11111111-2222-4333-8444-555555555555", ctx),
    ).rejects.toThrow(AppError);
  });

  it("el plan Gratis permite un solo menú", async () => {
    const free = await db().businesses.create({
      data: { slug: FREE_SLUG, name: "Gratis" },
      select: { id: true },
    });
    await createMenu(free.id, "Único", ctx);
    await expect(createMenu(free.id, "Segundo", ctx)).rejects.toThrow(LimitExceededError);
  });
});
