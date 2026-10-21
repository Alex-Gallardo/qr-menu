import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toProductFormInput } from "@/features/products/form-values";
import { checkSelection } from "@/features/products/options";
import { productFormSchema, type ProductFormInput } from "@/features/products/schemas";
import { createProduct, getProductForEdit, updateProduct } from "@/features/products/server";
import type { Membership } from "@/lib/auth/access";
import { db } from "@/lib/db";

/** QRM-015: "Tamaño" obligatorio y "Extras" 0–3, guardados con el producto. */

const SLUG = "zz-test-qrm015";
let businessId: string;
let actorId: string;
let ctx: { actorId: string; member: Membership };

const tamano: NonNullable<ProductFormInput["groups"]>[number] = {
  name: "Tamaño",
  required: true,
  min: "1",
  max: "1",
  options: [
    { name: "Mediano", price: "", is_available: true },
    { name: "Grande", price: "5", is_available: true },
  ],
};
const extras: NonNullable<ProductFormInput["groups"]>[number] = {
  name: "Extras",
  required: false,
  min: "1",
  max: "3",
  options: ["Queso", "Aguacate", "Tocino", "Huevo"].map((name, i) => ({
    name,
    price: String(5 + i),
    is_available: true,
  })),
};

const input = (over: Partial<ProductFormInput>) =>
  productFormSchema.parse({
    businessId,
    name: "Hamburguesa",
    description: "",
    category_id: "",
    price: "50",
    compare_at: "",
    tags: [],
    prep_minutes: "",
    image_url: null,
    image_blurhash: null,
    is_available: true,
    branches: [],
    ...over,
  });

const load = async (id: string) => (await getProductForEdit(businessId, id, []))!;

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  businessId = (
    await db().businesses.create({
      data: { slug: SLUG, name: "Prueba QRM-015" },
      select: { id: true },
    })
  ).id;
  const owner = await db().business_members.findFirst({ where: { role: "owner" } });
  if (!owner) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  actorId = owner.user_id;
  ctx = {
    actorId,
    member: { memberId: "test", businessId, role: "owner", allBranches: true, branchIds: [] },
  };
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().$disconnect();
});

describe("grupos de opciones", () => {
  it("guarda “Tamaño” obligatorio y “Extras” 0–3 y el cliente debe elegir tamaño", async () => {
    const { id } = await createProduct(input({ groups: [tamano, extras] }), ctx);
    const product = await load(id);
    expect(product.option_groups.map((g) => [g.name, g.min_select, g.max_select])).toEqual([
      ["Tamaño", 1, 1],
      ["Extras", 0, 3],
    ]);

    const [size, extra] = product.option_groups;
    const grande = size!.options[1]!.id;
    const [queso, aguacate, tocino, huevo] = extra!.options.map((o) => o.id);
    expect(checkSelection(product.option_groups, []).problems[0]!.message).toBe("Elige tu tamaño.");
    expect(
      checkSelection(product.option_groups, [grande, queso!, aguacate!, tocino!]),
    ).toMatchObject({
      ok: true,
      deltaCents: 500 + 500 + 600 + 700,
    });
    expect(
      checkSelection(product.option_groups, [grande, queso!, aguacate!, tocino!, huevo!]).ok,
    ).toBe(false);
  });

  it("al editar conserva los ids, actualiza, agrega y borra lo que se quitó", async () => {
    const { id } = await createProduct(input({ name: "Café", groups: [tamano, extras] }), ctx);
    const before = await load(id);
    const values = toProductFormInput(businessId, before, []);
    const [size, extra] = values.groups!;

    // Tamaño: renombra "Grande" y agrega "Familiar"; agota "Mediano". Extras: se quita el grupo.
    size!.options[1]!.name = "Grande (16 oz)";
    size!.options[0]!.is_available = false;
    size!.options.push({ name: "Familiar", price: "12", is_available: true });
    await updateProduct(
      { ...productFormSchema.parse({ ...values, groups: [size!] }), productId: id },
      ctx,
    );

    const after = await load(id);
    expect(after.option_groups).toHaveLength(1);
    const group = after.option_groups[0]!;
    expect(group.id).toBe(before.option_groups[0]!.id);
    expect(group.options.map((o) => o.name)).toEqual(["Mediano", "Grande (16 oz)", "Familiar"]);
    expect(group.options[0]!.id).toBe(before.option_groups[0]!.options[0]!.id);
    expect(group.options[1]!.id).toBe(before.option_groups[0]!.options[1]!.id);
    expect(group.options[0]!.is_available).toBe(false);
    expect(group.options[2]!.price_delta_cents).toBe(1200);
    // Las opciones del grupo borrado ya no existen.
    expect(await db().product_options.count({ where: { group_id: extra!.groupId! } })).toBe(0);
  });

  it("ids de otro producto se tratan como nuevos (no se roban opciones ajenas)", async () => {
    const a = await createProduct(input({ name: "Producto A", groups: [tamano] }), ctx);
    const b = await createProduct(input({ name: "Producto B" }), ctx);
    const foreign = toProductFormInput(businessId, await load(a.id), []).groups!;

    const bValues = toProductFormInput(businessId, await load(b.id), []);
    await updateProduct(
      { ...productFormSchema.parse({ ...bValues, groups: foreign }), productId: b.id },
      ctx,
    );

    const groupsA = (await load(a.id)).option_groups;
    const groupsB = (await load(b.id)).option_groups;
    expect(groupsA).toHaveLength(1);
    expect(groupsB).toHaveLength(1);
    expect(groupsB[0]!.id).not.toBe(groupsA[0]!.id);
    expect(groupsA[0]!.options.map((o) => o.name)).toEqual(["Mediano", "Grande"]);
  });

  it("quitar todos los grupos deja el producto sin opciones", async () => {
    const { id } = await createProduct(
      input({ name: "Sin opciones", groups: [tamano, extras] }),
      ctx,
    );
    const values = toProductFormInput(businessId, await load(id), []);
    await updateProduct(
      { ...productFormSchema.parse({ ...values, groups: [] }), productId: id },
      ctx,
    );
    expect((await load(id)).option_groups).toEqual([]);
  });
});
