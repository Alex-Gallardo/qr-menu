import "server-only";
import { deleteOwnMediaByUrl, isRegisteredMediaUrl } from "@/features/media/server";
import { assertWithinLimit } from "@/features/licensing/server";
import { canSeeBranch, type Membership } from "@/lib/auth/access";
import { audit, diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { AccessError, AppError } from "@/lib/errors";
import { copyName, isDefaultSetting, moveInList } from "./catalog";
import type { ProductFormOutput } from "./schemas";

type Ctx = { actorId: string; member: Membership };

const NOT_FOUND = "No encontramos ese producto. Puede que lo hayan borrado.";

const LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  category_id: true,
  price_cents: true,
  compare_at_cents: true,
  image_url: true,
  image_blurhash: true,
  tags: true,
  is_available: true,
  hidden_by_license: true,
  prep_minutes: true,
  sort: true,
} as const;

/** Catálogo del panel: productos sin borrar y la configuración de las sucursales visibles. */
export async function listCatalog(businessId: string, visibleBranchIds: string[]) {
  const [categories, products] = await Promise.all([
    db().product_categories.findMany({
      where: { business_id: businessId },
      orderBy: [{ sort: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        _count: { select: { products: { where: { deleted_at: null } } } },
      },
    }),
    db().products.findMany({
      where: { business_id: businessId, deleted_at: null },
      orderBy: [{ sort: "asc" }, { created_at: "asc" }],
      select: {
        ...LIST_SELECT,
        branch_settings: {
          where: { branch_id: { in: visibleBranchIds } },
          select: { branch_id: true, is_available: true, price_override_cents: true },
        },
        _count: { select: { option_groups: true } },
      },
    }),
  ]);
  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      productCount: c._count.products,
    })),
    products,
  };
}

export type CatalogProductRow = Awaited<ReturnType<typeof listCatalog>>["products"][number];

export async function getProductForEdit(
  businessId: string,
  productId: string,
  visibleBranchIds: string[],
) {
  return db().products.findFirst({
    where: { id: productId, business_id: businessId, deleted_at: null },
    select: {
      ...LIST_SELECT,
      branch_settings: {
        where: { branch_id: { in: visibleBranchIds } },
        select: { branch_id: true, is_available: true, price_override_cents: true },
      },
    },
  });
}

async function getLiveProduct(businessId: string, productId: string) {
  const product = await db().products.findFirst({
    where: { id: productId, business_id: businessId, deleted_at: null },
    select: { ...LIST_SELECT },
  });
  if (!product) throw new AppError("not_found", NOT_FOUND);
  return product;
}

async function assertCategory(businessId: string, categoryId: string | null) {
  if (!categoryId) return;
  const category = await db().product_categories.findFirst({
    where: { id: categoryId, business_id: businessId },
    select: { id: true },
  });
  if (!category) throw new AppError("not_found", "Esa categoría ya no existe. Elige otra.");
}

/** Solo fotos subidas por este negocio (o la misma que ya tenía). */
async function assertImage(businessId: string, url: string | null, previous: string | null) {
  if (!url || url === previous) return;
  if (!(await isRegisteredMediaUrl(businessId, url))) {
    throw new AppError("forbidden", "Esa foto no es de tu negocio. Súbela otra vez.");
  }
}

/** Borra la foto anterior si ya nadie la usa (un duplicado comparte la misma foto). */
async function releaseImage(businessId: string, url: string | null) {
  if (!url) return;
  const [products, business] = await Promise.all([
    db().products.count({ where: { business_id: businessId, image_url: url } }),
    db().businesses.count({
      where: { id: businessId, OR: [{ logo_url: url }, { cover_url: url }] },
    }),
  ]);
  if (products === 0 && business === 0) await deleteOwnMediaByUrl(businessId, url);
}

/**
 * Guarda disponibilidad y precio por sucursal. Solo las sucursales del negocio
 * que el miembro puede ver; si queda igual al catálogo, se borra la fila.
 */
async function writeBranchSettings(
  businessId: string,
  productId: string,
  settings: ProductFormOutput["branches"],
  member: Membership,
) {
  if (settings.length === 0) return;
  const branches = await db().branches.findMany({
    where: { business_id: businessId, id: { in: settings.map((s) => s.branchId) } },
    select: { id: true },
  });
  const valid = new Set(branches.map((b) => b.id));
  for (const s of settings) {
    if (!valid.has(s.branchId) || !canSeeBranch(member, s.branchId)) {
      throw new AccessError("branch_forbidden", "No tienes acceso a esa sucursal.");
    }
  }
  await db().$transaction(
    settings.map((s) => {
      const key = { branch_id_product_id: { branch_id: s.branchId, product_id: productId } };
      const values = { is_available: s.is_available, price_override_cents: s.price_override_cents };
      return isDefaultSetting(values)
        ? db().branch_products.deleteMany({
            where: { branch_id: s.branchId, product_id: productId },
          })
        : db().branch_products.upsert({
            where: key,
            create: { branch_id: s.branchId, product_id: productId, ...values },
            update: values,
          });
    }),
  );
}

async function nextSort(businessId: string) {
  const last = await db().products.aggregate({
    where: { business_id: businessId },
    _max: { sort: true },
  });
  return (last._max.sort ?? -1) + 1;
}

/** Alta: límite del plan → categoría y foto válidas → producto → sucursales → auditoría. */
export async function createProduct(input: ProductFormOutput, ctx: Ctx) {
  const { businessId, data } = input;
  await assertWithinLimit(businessId, "products");
  await assertCategory(businessId, data.category_id);
  await assertImage(businessId, data.image_url, null);

  const product = await db().products.create({
    data: { ...data, business_id: businessId, sort: await nextSort(businessId) },
    select: { id: true },
  });
  await writeBranchSettings(businessId, product.id, input.branches, ctx.member);
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "product.create",
    entity: "products",
    entityId: product.id,
    diff: { name: data.name, price_cents: data.price_cents },
  });
  return product;
}

export async function updateProduct(input: ProductFormOutput & { productId: string }, ctx: Ctx) {
  const { businessId, productId, data } = input;
  const before = await getLiveProduct(businessId, productId);
  await assertCategory(businessId, data.category_id);
  await assertImage(businessId, data.image_url, before.image_url);

  await db().products.update({ where: { id: productId }, data });
  await writeBranchSettings(businessId, productId, input.branches, ctx.member);
  if (before.image_url !== data.image_url) await releaseImage(businessId, before.image_url);

  const changes = diffFields(
    { ...before, tags: before.tags.join(",") },
    { ...data, tags: data.tags.join(","), image_blurhash: undefined },
  );
  if (Object.keys(changes).length > 0) {
    await audit({
      actorId: ctx.actorId,
      actorKind: "user",
      businessId,
      action: "product.update",
      entity: "products",
      entityId: productId,
      diff: changes,
    });
  }
}

/** "Disponible" del catálogo: apagado = agotado en todas las sucursales. */
export async function setProductAvailable(
  businessId: string,
  productId: string,
  available: boolean,
  ctx: Ctx,
) {
  const before = await getLiveProduct(businessId, productId);
  if (before.is_available === available) return;
  await db().products.update({ where: { id: productId }, data: { is_available: available } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "product.availability",
    entity: "products",
    entityId: productId,
    diff: { is_available: [before.is_available, available] },
  });
}

/** "Disponible aquí": solo esa sucursal; conserva su precio propio. */
export async function setBranchAvailable(
  businessId: string,
  branchId: string,
  productId: string,
  available: boolean,
  ctx: Ctx,
) {
  await getLiveProduct(businessId, productId);
  const current = await db().branch_products.findUnique({
    where: { branch_id_product_id: { branch_id: branchId, product_id: productId } },
    select: { price_override_cents: true },
  });
  await writeBranchSettings(
    businessId,
    productId,
    [
      {
        branchId,
        is_available: available,
        price_override_cents: current?.price_override_cents ?? null,
      },
    ],
    ctx.member,
  );
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "product.branch_availability",
    entity: "branch_products",
    entityId: productId,
    diff: { branch_id: branchId, is_available: available },
  });
}

/** Borrado suave: se puede deshacer y el soporte puede restaurarlo. */
export async function softDeleteProduct(businessId: string, productId: string, ctx: Ctx) {
  const product = await getLiveProduct(businessId, productId);
  await db().products.update({ where: { id: productId }, data: { deleted_at: new Date() } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "product.delete",
    entity: "products",
    entityId: productId,
    diff: { name: product.name },
  });
  return { name: product.name };
}

export async function restoreProduct(businessId: string, productId: string, ctx: Ctx) {
  const product = await db().products.findFirst({
    where: { id: productId, business_id: businessId, deleted_at: { not: null } },
    select: { id: true },
  });
  if (!product) throw new AppError("not_found", NOT_FOUND);
  await assertWithinLimit(businessId, "products");
  await db().products.update({ where: { id: productId }, data: { deleted_at: null } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "product.restore",
    entity: "products",
    entityId: productId,
  });
}

/** Copia la ficha, sus opciones y su configuración por sucursal, justo debajo del original. */
export async function duplicateProduct(businessId: string, productId: string, ctx: Ctx) {
  await assertWithinLimit(businessId, "products");
  const source = await db().products.findFirst({
    where: { id: productId, business_id: businessId, deleted_at: null },
    include: {
      option_groups: { include: { options: true } },
      branch_settings: true,
    },
  });
  if (!source) throw new AppError("not_found", NOT_FOUND);

  const names = await db().products.findMany({
    where: {
      business_id: businessId,
      deleted_at: null,
      name: { startsWith: source.name.replace(/ \(copia(?: \d+)?\)$/, "") },
    },
    select: { name: true },
  });

  const copy = await db().$transaction(async (tx) => {
    await tx.products.updateMany({
      where: { business_id: businessId, sort: { gt: source.sort } },
      data: { sort: { increment: 1 } },
    });
    return tx.products.create({
      data: {
        business_id: businessId,
        category_id: source.category_id,
        name: copyName(
          source.name,
          names.map((n) => n.name),
        ),
        description: source.description,
        price_cents: source.price_cents,
        compare_at_cents: source.compare_at_cents,
        image_url: source.image_url,
        image_blurhash: source.image_blurhash,
        tags: source.tags,
        is_available: source.is_available,
        prep_minutes: source.prep_minutes,
        sort: source.sort + 1,
        option_groups: {
          create: source.option_groups.map((g) => ({
            name: g.name,
            min_select: g.min_select,
            max_select: g.max_select,
            sort: g.sort,
            options: {
              create: g.options.map((o) => ({
                name: o.name,
                price_delta_cents: o.price_delta_cents,
                is_available: o.is_available,
                sort: o.sort,
              })),
            },
          })),
        },
        branch_settings: {
          create: source.branch_settings.map((s) => ({
            branch_id: s.branch_id,
            is_available: s.is_available,
            price_override_cents: s.price_override_cents,
          })),
        },
      },
      select: { id: true, name: true },
    });
  });

  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "product.duplicate",
    entity: "products",
    entityId: copy.id,
    diff: { from: productId, name: copy.name },
  });
  return copy;
}

/**
 * Sube o baja el producto dentro de su categoría. Renumera el orden de todo el
 * catálogo para que no queden empates (el seed y los duplicados pueden dejarlos).
 */
export async function moveProduct(businessId: string, productId: string, direction: -1 | 1) {
  const all = await db().products.findMany({
    where: { business_id: businessId, deleted_at: null },
    orderBy: [{ sort: "asc" }, { created_at: "asc" }],
    select: { id: true, category_id: true, sort: true },
  });
  const product = all.find((p) => p.id === productId);
  if (!product) throw new AppError("not_found", NOT_FOUND);

  const siblings = all.filter((p) => p.category_id === product.category_id);
  const moved = moveInList(
    siblings,
    siblings.findIndex((p) => p.id === productId),
    direction,
  );
  if (!moved) return;

  let next = 0;
  const reordered = all.map((p) => (p.category_id === product.category_id ? moved[next++]! : p));
  await db().$transaction(
    reordered.flatMap((p, sort) =>
      p.sort === sort ? [] : [db().products.update({ where: { id: p.id }, data: { sort } })],
    ),
  );
}

// ── Categorías ──────────────────────────────────────────────────────────────

async function assertCategoryNameFree(businessId: string, name: string, exceptId?: string) {
  const other = await db().product_categories.findFirst({
    where: {
      business_id: businessId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (other) throw new AppError("duplicate", "Ya tienes una categoría con ese nombre.");
}

export async function createCategory(businessId: string, name: string, ctx: Ctx) {
  await assertCategoryNameFree(businessId, name);
  const count = await db().product_categories.count({ where: { business_id: businessId } });
  const category = await db().product_categories.create({
    data: { business_id: businessId, name, sort: count },
    select: { id: true, name: true },
  });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "category.create",
    entity: "product_categories",
    entityId: category.id,
    diff: { name },
  });
  return category;
}

async function getCategory(businessId: string, categoryId: string) {
  const category = await db().product_categories.findFirst({
    where: { id: categoryId, business_id: businessId },
    select: { id: true, name: true, sort: true },
  });
  if (!category) throw new AppError("not_found", "Esa categoría ya no existe.");
  return category;
}

export async function renameCategory(
  businessId: string,
  categoryId: string,
  name: string,
  ctx: Ctx,
) {
  const before = await getCategory(businessId, categoryId);
  if (before.name === name) return;
  await assertCategoryNameFree(businessId, name, categoryId);
  await db().product_categories.update({ where: { id: categoryId }, data: { name } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "category.update",
    entity: "product_categories",
    entityId: categoryId,
    diff: { name: [before.name, name] },
  });
}

/**
 * Borra la categoría; sus productos quedan "Sin categoría" (no se borran).
 * Devuelve lo necesario para deshacer.
 */
export async function deleteCategory(businessId: string, categoryId: string, ctx: Ctx) {
  const category = await getCategory(businessId, categoryId);
  const products = await db().products.findMany({
    where: { category_id: categoryId },
    select: { id: true },
  });
  await db().product_categories.delete({ where: { id: categoryId } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "category.delete",
    entity: "product_categories",
    entityId: categoryId,
    diff: { name: category.name },
  });
  return { category, productIds: products.map((p) => p.id) };
}

export type DeletedCategory = Awaited<ReturnType<typeof deleteCategory>>;

/** "Deshacer": vuelve a crear la categoría con su id y orden, y le devuelve sus productos. */
export async function restoreCategory(businessId: string, deleted: DeletedCategory, ctx: Ctx) {
  await assertCategoryNameFree(businessId, deleted.category.name);
  await db().$transaction([
    db().product_categories.create({ data: { ...deleted.category, business_id: businessId } }),
    // Solo los que siguen sin categoría (si alguien ya los movió, se respeta).
    db().products.updateMany({
      where: { business_id: businessId, id: { in: deleted.productIds }, category_id: null },
      data: { category_id: deleted.category.id },
    }),
  ]);
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "category.restore",
    entity: "product_categories",
    entityId: deleted.category.id,
  });
}

export async function moveCategory(businessId: string, categoryId: string, direction: -1 | 1) {
  const categories = await db().product_categories.findMany({
    where: { business_id: businessId },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
    select: { id: true, sort: true },
  });
  const moved = moveInList(
    categories,
    categories.findIndex((c) => c.id === categoryId),
    direction,
  );
  if (!moved) return;
  await db().$transaction(
    moved.flatMap((c, sort) =>
      c.sort === sort
        ? []
        : [db().product_categories.update({ where: { id: c.id }, data: { sort } })],
    ),
  );
}
