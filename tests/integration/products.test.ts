import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { viewForBranch } from "@/features/products/catalog";
import { productFormSchema, type ProductFormInput } from "@/features/products/schemas";
import {
  createCategory,
  createProduct,
  deleteCategory,
  duplicateProduct,
  getProductForEdit,
  listCatalog,
  moveProduct,
  restoreCategory,
  restoreProduct,
  setBranchAvailable,
  setProductAvailable,
  softDeleteProduct,
  updateProduct,
} from "@/features/products/server";
import { getUsage } from "@/features/licensing/server";
import type { Membership } from "@/lib/auth/access";
import { db } from "@/lib/db";
import { AccessError, AppError } from "@/lib/errors";

/** QRM-014: catálogo del negocio con disponibilidad y precio por sucursal. */

const SLUG = "zz-test-qrm014";
let businessId: string;
let zona1: string;
let antigua: string;
let actorId: string;
let owner: Membership;
let categoryId: string;

const input = (over: Partial<ProductFormInput> = {}) =>
  productFormSchema.parse({
    businessId,
    name: "Desayuno chapín",
    description: "Huevos, frijoles y plátanos.",
    category_id: categoryId,
    price: "45",
    compare_at: "",
    tags: ["popular"],
    prep_minutes: "15",
    image_url: null,
    image_blurhash: null,
    is_available: true,
    branches: [],
    ...over,
  });

const ctx = () => ({ actorId, member: owner });

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-014",
      branches: {
        create: [
          { slug: "zona-1", name: "Zona 1", whatsapp_e164: "+50255550001", sort: 0 },
          { slug: "antigua", name: "Antigua", whatsapp_e164: "+50255550002", sort: 1 },
        ],
      },
    },
    select: { id: true, branches: { select: { id: true, slug: true } } },
  });
  businessId = biz.id;
  zona1 = biz.branches.find((b) => b.slug === "zona-1")!.id;
  antigua = biz.branches.find((b) => b.slug === "antigua")!.id;
  const member = await db().business_members.findFirst({ where: { role: "owner" } });
  if (!member) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  actorId = member.user_id;
  owner = { memberId: "test", businessId, role: "owner", allBranches: true, branchIds: [] };
  categoryId = (await createCategory(businessId, "Desayunos", ctx())).id;
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().$disconnect();
});

describe("disponibilidad y precio por sucursal", () => {
  it("agotar solo en Antigua no afecta Zona 1", async () => {
    const { id } = await createProduct(
      input({
        branches: [
          { branchId: zona1, is_available: true, price: "" },
          { branchId: antigua, is_available: false, price: "50" },
        ],
      }),
      ctx(),
    );

    const { products } = await listCatalog(businessId, [zona1, antigua]);
    const product = products.find((p) => p.id === id)!;
    expect(product.price_cents).toBe(4500);
    // Zona 1 hereda todo: no se guarda fila.
    expect(product.branch_settings).toHaveLength(1);

    expect(viewForBranch(product, antigua, product.branch_settings)).toMatchObject({
      available: false,
      unavailableReason: "this_branch",
      priceCents: 5000,
    });
    expect(viewForBranch(product, zona1, product.branch_settings)).toMatchObject({
      available: true,
      priceCents: 4500,
    });
  });

  it("el interruptor de la sucursal conserva su precio propio", async () => {
    const { id } = await createProduct(
      input({ name: "Pepián", branches: [{ branchId: antigua, is_available: true, price: "60" }] }),
      ctx(),
    );
    await setBranchAvailable(businessId, antigua, id, false, ctx());
    let row = await db().branch_products.findUnique({
      where: { branch_id_product_id: { branch_id: antigua, product_id: id } },
    });
    expect(row).toMatchObject({ is_available: false, price_override_cents: 6000 });

    // Disponible y sin precio propio = igual que el catálogo → la fila se borra.
    await updateProduct(
      {
        ...input({
          name: "Pepián",
          branches: [{ branchId: antigua, is_available: true, price: "" }],
        }),
        productId: id,
      },
      ctx(),
    );
    row = await db().branch_products.findUnique({
      where: { branch_id_product_id: { branch_id: antigua, product_id: id } },
    });
    expect(row).toBeNull();
  });

  it("agotado en el catálogo se ve agotado en ambas sucursales", async () => {
    const { id } = await createProduct(input({ name: "Atol" }), ctx());
    await setProductAvailable(businessId, id, false, ctx());
    const product = (await getProductForEdit(businessId, id, [zona1, antigua]))!;
    expect(viewForBranch(product, zona1, product.branch_settings).unavailableReason).toBe(
      "everywhere",
    );
    expect(viewForBranch(product, antigua, product.branch_settings).unavailableReason).toBe(
      "everywhere",
    );
  });

  it("el encargado de Zona 1 no puede tocar Antigua", async () => {
    const { id } = await createProduct(input({ name: "Rellenitos" }), ctx());
    const manager: Membership = {
      ...owner,
      role: "manager",
      allBranches: false,
      branchIds: [zona1],
    };
    await expect(
      setBranchAvailable(businessId, antigua, id, false, { actorId, member: manager }),
    ).rejects.toThrow(AccessError);
    await setBranchAvailable(businessId, zona1, id, false, { actorId, member: manager });
    const product = (await getProductForEdit(businessId, id, [zona1, antigua]))!;
    expect(product.branch_settings).toEqual([
      { branch_id: zona1, is_available: false, price_override_cents: null },
    ]);
  });

  it("no acepta sucursales de otro negocio", async () => {
    const other = await db().branches.findFirst({
      where: { business: { slug: "cafe-el-portal" } },
    });
    await expect(
      createProduct(
        input({
          name: "Ajeno",
          branches: [{ branchId: other!.id, is_available: false, price: "" }],
        }),
        ctx(),
      ),
    ).rejects.toThrow(AccessError);
  });
});

describe("catálogo", () => {
  it("rechaza fotos que no subió el negocio", async () => {
    await expect(
      createProduct(
        input({ name: "Con foto ajena", image_url: "https://example.com/x.webp" }),
        ctx(),
      ),
    ).rejects.toThrow(AppError);
  });

  it("duplica con opciones y configuración por sucursal, justo debajo", async () => {
    const { id } = await createProduct(
      input({ name: "Café", branches: [{ branchId: antigua, is_available: false, price: "18" }] }),
      ctx(),
    );
    await db().product_option_groups.create({
      data: {
        product_id: id,
        name: "Tamaño",
        min_select: 1,
        max_select: 1,
        options: { create: [{ name: "Mediano" }, { name: "Grande", price_delta_cents: 400 }] },
      },
    });

    const copy = await duplicateProduct(businessId, id, ctx());
    expect(copy.name).toBe("Café (copia)");
    const full = await db().products.findUniqueOrThrow({
      where: { id: copy.id },
      include: { option_groups: { include: { options: true } }, branch_settings: true },
    });
    expect(full.option_groups[0]!.options).toHaveLength(2);
    expect(full.branch_settings).toMatchObject([
      { branch_id: antigua, is_available: false, price_override_cents: 1800 },
    ]);

    const { products } = await listCatalog(businessId, []);
    const ids = products.map((p) => p.id);
    expect(ids.indexOf(copy.id)).toBe(ids.indexOf(id) + 1);
    expect((await duplicateProduct(businessId, id, ctx())).name).toBe("Café (copia 2)");
  });

  it("sube y baja dentro de la categoría", async () => {
    const before = (await listCatalog(businessId, [])).products.filter(
      (p) => p.category_id === categoryId,
    );
    const second = before[1]!;
    await moveProduct(businessId, second.id, -1);
    const after = (await listCatalog(businessId, [])).products.filter(
      (p) => p.category_id === categoryId,
    );
    expect(after[0]!.id).toBe(second.id);
    expect(after[1]!.id).toBe(before[0]!.id);
    expect(new Set(after.map((p) => p.sort)).size).toBe(after.length);
  });

  it("borrar es suave: sale del catálogo y del límite, y se puede deshacer", async () => {
    const { id } = await createProduct(input({ name: "Para borrar" }), ctx());
    const used = await getUsage(businessId, "products");
    await softDeleteProduct(businessId, id, ctx());
    expect(await getUsage(businessId, "products")).toBe(used - 1);
    expect((await listCatalog(businessId, [])).products.some((p) => p.id === id)).toBe(false);
    await restoreProduct(businessId, id, ctx());
    expect(await getUsage(businessId, "products")).toBe(used);
  });

  it("categorías: sin nombres repetidos; borrar deja productos sin categoría y deshacer los devuelve", async () => {
    await expect(createCategory(businessId, "desayunos", ctx())).rejects.toThrow(AppError);
    const bebidas = await createCategory(businessId, "Bebidas", ctx());
    const { id } = await createProduct(input({ name: "Horchata", category_id: bebidas.id }), ctx());

    const deleted = await deleteCategory(businessId, bebidas.id, ctx());
    expect(deleted.productIds).toEqual([id]);
    expect((await db().products.findUniqueOrThrow({ where: { id } })).category_id).toBeNull();

    await restoreCategory(businessId, deleted, ctx());
    expect((await db().products.findUniqueOrThrow({ where: { id } })).category_id).toBe(bebidas.id);
  });
});
