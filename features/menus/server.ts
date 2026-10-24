import "server-only";
import { z } from "@/lib/zod";
import type { Entitlements } from "@/features/licensing/entitlements";
import { assertWithinLimit } from "@/features/licensing/server";
import { copyName } from "@/features/products/catalog";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { MenuDocumentOutput } from "./schemas";
import { allowedTemplates, MENU_TEMPLATES, type MenuTemplate } from "./structure";

type Ctx = { actorId: string };

const NOT_FOUND = "No encontramos ese menú. Puede que lo hayan borrado.";

/** Menús del negocio con sus conteos (predeterminado primero, luego por nombre). */
export async function listMenus(businessId: string) {
  const menus = await db().menus.findMany({
    where: { business_id: businessId },
    orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      template: true,
      is_active: true,
      is_default: true,
      hidden_by_license: true,
      sections: { select: { _count: { select: { items: true } } } },
      _count: { select: { sections: true, schedules: true } },
    },
  });
  return menus.map(({ sections, _count, ...menu }) => ({
    ...menu,
    sectionCount: _count.sections,
    itemCount: sections.reduce((n, s) => n + s._count.items, 0),
    scheduleCount: _count.schedules,
  }));
}

export type MenuRow = Awaited<ReturnType<typeof listMenus>>[number];

/** Menú con su estructura para el editor. */
export async function getMenuForEdit(businessId: string, menuId: string) {
  return db().menus.findFirst({
    where: { id: menuId, business_id: businessId },
    select: {
      id: true,
      name: true,
      description: true,
      template: true,
      is_active: true,
      is_default: true,
      sections: {
        orderBy: [{ sort: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          items: {
            orderBy: [{ sort: "asc" }, { id: "asc" }],
            select: { id: true, product_id: true, price_override_cents: true, is_featured: true },
          },
        },
      },
    },
  });
}

/** Catálogo para el selector de productos del editor (sin borrados). */
export async function listPickerProducts(businessId: string) {
  return db().products.findMany({
    where: { business_id: businessId, deleted_at: null },
    orderBy: [{ category: { sort: "asc" } }, { sort: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      name: true,
      price_cents: true,
      image_url: true,
      is_available: true,
      category: { select: { name: true } },
    },
  });
}

export type PickerProduct = Awaited<ReturnType<typeof listPickerProducts>>[number];

async function getMenu(businessId: string, menuId: string) {
  const menu = await db().menus.findFirst({
    where: { id: menuId, business_id: businessId },
    select: { id: true, name: true, is_active: true, is_default: true },
  });
  if (!menu) throw new AppError("not_found", NOT_FOUND);
  return menu;
}

function assertTemplate(template: MenuTemplate, entitlements: Entitlements) {
  if (!allowedTemplates(entitlements.features.includes("all_templates")).includes(template)) {
    const label = MENU_TEMPLATES.find((t) => t.value === template)?.label ?? template;
    throw new AppError(
      "feature_unavailable",
      `Tu plan incluye la plantilla Clásico. Mejora tu plan para usar ${label}.`,
    );
  }
}

/** Nuevo menú vacío. El primero del negocio queda como predeterminado. */
export async function createMenu(businessId: string, name: string, ctx: Ctx) {
  await assertWithinLimit(businessId, "menus");
  const hasDefault = await db().menus.count({
    where: { business_id: businessId, is_default: true },
  });
  const menu = await db().menus.create({
    data: { business_id: businessId, name, template: "clasico", is_default: hasDefault === 0 },
    select: { id: true },
  });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "menu.create",
    entity: "menus",
    entityId: menu.id,
    diff: { name },
  });
  return menu;
}

/**
 * Guarda el documento del editor: datos del menú y su estructura completa, que
 * se reemplaza en una transacción. Solo productos vivos de este negocio. Sin
 * auditoría por cada autoguardado (serían decenas por sesión).
 */
export async function saveMenuDocument(input: MenuDocumentOutput, entitlements: Entitlements) {
  const { businessId, menuId, data, sections } = input;
  await getMenu(businessId, menuId);
  assertTemplate(data.template, entitlements);

  const productIds = [...new Set(sections.flatMap((s) => s.items.map((i) => i.product_id)))];
  const valid = await db().products.count({
    where: { id: { in: productIds }, business_id: businessId, deleted_at: null },
  });
  if (valid !== productIds.length) {
    throw new AppError("not_found", "Uno de los productos ya no existe. Recarga la página.");
  }

  await db().$transaction(async (tx) => {
    await tx.menus.update({ where: { id: menuId }, data });
    await tx.menu_sections.deleteMany({ where: { menu_id: menuId } });
    for (const { items, ...section } of sections) {
      await tx.menu_sections.create({
        data: { ...section, menu_id: menuId, items: { create: items } },
      });
    }
  });
}

/** Copia el menú (datos, secciones y productos; no la programación), inactivo. */
export async function duplicateMenu(businessId: string, menuId: string, ctx: Ctx) {
  await assertWithinLimit(businessId, "menus");
  const source = await db().menus.findFirst({
    where: { id: menuId, business_id: businessId },
    include: { sections: { include: { items: true } } },
  });
  if (!source) throw new AppError("not_found", NOT_FOUND);
  const names = await db().menus.findMany({
    where: { business_id: businessId },
    select: { name: true },
  });

  const copy = await db().menus.create({
    data: {
      business_id: businessId,
      name: copyName(
        source.name,
        names.map((n) => n.name),
      ).slice(0, 60),
      description: source.description,
      template: source.template,
      is_active: false,
      is_default: false,
      sections: {
        create: source.sections.map((s) => ({
          name: s.name,
          description: s.description,
          sort: s.sort,
          items: {
            create: s.items.map((i) => ({
              product_id: i.product_id,
              price_override_cents: i.price_override_cents,
              is_featured: i.is_featured,
              sort: i.sort,
            })),
          },
        })),
      },
    },
    select: { id: true, name: true },
  });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "menu.duplicate",
    entity: "menus",
    entityId: copy.id,
    diff: { from: menuId, name: copy.name },
  });
  return copy;
}

/** Pausar o activar. El predeterminado no se puede pausar (es el respaldo del menú del día). */
export async function setMenuActive(businessId: string, menuId: string, active: boolean, ctx: Ctx) {
  const menu = await getMenu(businessId, menuId);
  if (menu.is_active === active) return;
  if (!active && menu.is_default) {
    throw new AppError(
      "default_menu",
      "Es tu menú predeterminado: elige otro como predeterminado antes de pausarlo.",
    );
  }
  await db().menus.update({ where: { id: menuId }, data: { is_active: active } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "menu.update",
    entity: "menus",
    entityId: menuId,
    diff: { is_active: [menu.is_active, active] },
  });
}

/** Lo vuelve el predeterminado (y lo activa). Se ve cuando no hay programación que aplique. */
export async function setDefaultMenu(businessId: string, menuId: string, ctx: Ctx) {
  const menu = await getMenu(businessId, menuId);
  if (menu.is_default) return;
  await db().$transaction([
    db().menus.updateMany({
      where: { business_id: businessId, is_default: true },
      data: { is_default: false },
    }),
    db().menus.update({ where: { id: menuId }, data: { is_default: true, is_active: true } }),
  ]);
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "menu.default",
    entity: "menus",
    entityId: menuId,
    diff: { name: menu.name },
  });
}

// ── Borrar y deshacer ───────────────────────────────────────────────────────

const UNDO_WINDOW_MS = 10 * 60 * 1000;

const snapshotSchema = z.object({
  menu: z.object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    template: z
      .enum(MENU_TEMPLATES.map((t) => t.value) as [MenuTemplate, ...MenuTemplate[]])
      .nullable(),
    is_active: z.boolean(),
    is_default: z.boolean(),
    created_at: z.string(),
  }),
  sections: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      sort: z.number().int(),
      items: z.array(
        z.object({
          product_id: z.uuid(),
          price_override_cents: z.number().int().nullable(),
          is_featured: z.boolean(),
          sort: z.number().int(),
        }),
      ),
    }),
  ),
  schedules: z.array(
    z.object({
      time_slot_id: z.uuid(),
      branch_id: z.uuid().nullable(),
      weekdays: z.array(z.number().int()),
      starts_on: z.string().nullable(),
      ends_on: z.string().nullable(),
      priority: z.number().int(),
    }),
  ),
  overrides: z.array(
    z.object({
      branch_id: z.uuid().nullable(),
      date: z.string(),
      time_slot_id: z.uuid().nullable(),
      note: z.string().nullable(),
    }),
  ),
});

/**
 * Borra el menú con su programación. Las fechas especiales que lo usaban se
 * borran también (si no, quedarían como "Cerrado"). La copia para deshacer
 * queda en la auditoría: el navegador solo manda el id.
 */
export async function deleteMenu(businessId: string, menuId: string, ctx: Ctx) {
  const menu = await db().menus.findFirst({
    where: { id: menuId, business_id: businessId },
    select: {
      id: true,
      name: true,
      description: true,
      template: true,
      is_active: true,
      is_default: true,
      created_at: true,
      sections: {
        select: {
          name: true,
          description: true,
          sort: true,
          items: {
            select: { product_id: true, price_override_cents: true, is_featured: true, sort: true },
          },
        },
      },
      schedules: {
        select: {
          time_slot_id: true,
          branch_id: true,
          weekdays: true,
          starts_on: true,
          ends_on: true,
          priority: true,
        },
      },
      overrides: { select: { branch_id: true, date: true, time_slot_id: true, note: true } },
    },
  });
  if (!menu) throw new AppError("not_found", NOT_FOUND);
  const { sections, schedules, overrides, ...row } = menu;
  const snapshot = JSON.parse(JSON.stringify({ menu: row, sections, schedules, overrides }));

  await db().$transaction([
    db().menu_overrides.deleteMany({ where: { menu_id: menuId } }),
    db().menus.delete({ where: { id: menuId } }),
  ]);
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "menu.delete",
    entity: "menus",
    entityId: menuId,
    diff: { name: menu.name, schedules: schedules.length, snapshot },
  });
  return { name: menu.name, schedules: schedules.length, wasDefault: menu.is_default };
}

const toDate = (iso: string | null) => (iso ? new Date(iso) : null);

/** "Deshacer": el menú con su mismo id, estructura, programación y fechas especiales. */
export async function restoreMenu(businessId: string, menuId: string, ctx: Ctx) {
  const entry = await db().audit_logs.findFirst({
    where: {
      business_id: businessId,
      action: "menu.delete",
      entity_id: menuId,
      created_at: { gte: new Date(Date.now() - UNDO_WINDOW_MS) },
    },
    orderBy: { created_at: "desc" },
    select: { diff: true },
  });
  const parsed = snapshotSchema.safeParse((entry?.diff as { snapshot?: unknown } | null)?.snapshot);
  if (!parsed.success) throw new AppError("not_found", "Ya no se puede deshacer.");
  if (await db().menus.findUnique({ where: { id: menuId }, select: { id: true } })) return;
  await assertWithinLimit(businessId, "menus");

  const { menu, sections, schedules, overrides } = parsed.data;
  // Solo lo que todavía existe (un producto, franja o sucursal pudo borrarse).
  const [products, slots, branches, hasDefault] = await Promise.all([
    db().products.findMany({
      where: { business_id: businessId, deleted_at: null },
      select: { id: true },
    }),
    db().time_slots.findMany({ where: { business_id: businessId }, select: { id: true } }),
    db().branches.findMany({ where: { business_id: businessId }, select: { id: true } }),
    db().menus.count({ where: { business_id: businessId, is_default: true } }),
  ]);
  const productIds = new Set(products.map((p) => p.id));
  const slotIds = new Set(slots.map((s) => s.id));
  const branchIds = new Set(branches.map((b) => b.id));
  const branchOk = (id: string | null) => id === null || branchIds.has(id);

  await db().$transaction(async (tx) => {
    await tx.menus.create({
      data: {
        ...menu,
        created_at: new Date(menu.created_at),
        business_id: businessId,
        // Si mientras tanto se eligió otro predeterminado, ese se respeta.
        is_default: menu.is_default && hasDefault === 0,
        sections: {
          create: sections.map(({ items, ...s }) => ({
            ...s,
            items: { create: items.filter((i) => productIds.has(i.product_id)) },
          })),
        },
      },
    });
    await tx.menu_schedules.createMany({
      data: schedules
        .filter((s) => slotIds.has(s.time_slot_id) && branchOk(s.branch_id))
        .map((s) => ({
          ...s,
          menu_id: menuId,
          starts_on: toDate(s.starts_on),
          ends_on: toDate(s.ends_on),
        })),
    });
    await tx.menu_overrides.createMany({
      data: overrides
        .filter(
          (o) => (o.time_slot_id === null || slotIds.has(o.time_slot_id)) && branchOk(o.branch_id),
        )
        .map((o) => ({ ...o, business_id: businessId, menu_id: menuId, date: new Date(o.date) })),
    });
  });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "menu.restore",
    entity: "menus",
    entityId: menuId,
  });
}
