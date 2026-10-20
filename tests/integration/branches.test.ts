import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultWeek } from "@/features/branches/hours";
import { branchFormSchema, type BranchFormInput } from "@/features/branches/schemas";
import {
  createBranchForBusiness,
  getBranch,
  updateBranchForBusiness,
} from "@/features/branches/server";
import { getEntitlements } from "@/features/licensing/server";
import { db } from "@/lib/db";
import { AppError, LimitExceededError } from "@/lib/errors";

/** Criterio de QRM-012: crear 2 sucursales con reglas distintas; respeta el límite de licencia. */

const PREFIX = "zz-test-qrm012";
const DAY = 24 * 60 * 60 * 1000;
let actorId: string;

async function tempBusiness(suffix: string, plan_id: string) {
  return db().businesses.create({
    data: {
      slug: `${PREFIX}-${suffix}`,
      name: `Prueba QRM-012 ${suffix}`,
      license: { create: { plan_id, status: "active", ends_at: new Date(Date.now() + 30 * DAY) } },
    },
    select: { id: true },
  });
}

const form = (businessId: string, over: Partial<BranchFormInput>): BranchFormInput => ({
  businessId,
  name: "Sucursal",
  slug: "sucursal",
  address: "",
  address_reference: "",
  city: "",
  location: null,
  whatsapp: "5555-1234",
  phone: "",
  google_place_id: "",
  accepts_dine_in: true,
  accepts_takeout: true,
  accepts_delivery: false,
  accepts_transfer: true,
  delivery_fee: "0",
  delivery_radius_km: "",
  min_order: "0",
  delivery_requires_location: true,
  preorder_mode: "off",
  preorder_min_lead_min: 30,
  preorder_max_days: 2,
  is_active: true,
  hours: defaultWeek(),
  ...over,
});

async function create(businessId: string, over: Partial<BranchFormInput>) {
  const entitlements = await getEntitlements(businessId);
  return createBranchForBusiness(branchFormSchema.parse(form(businessId, over)), {
    actorId,
    entitlements,
  });
}

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  const owner = await db().business_members.findFirst({
    where: { role: "owner" },
    select: { user_id: true },
  });
  if (!owner) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  actorId = owner.user_id;
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await db().$disconnect();
});

describe("sucursales", () => {
  it("crea 2 sucursales con reglas distintas (plan Negocio)", async () => {
    const { id } = await tempBusiness("negocio", "negocio");
    const hoursZona10 = defaultWeek();
    const hoursAntigua = defaultWeek().map((d) => ({
      ...d,
      open: true,
      opens: "07:00",
      closes: "22:00",
    }));

    const a = await create(id, {
      name: "Zona 10",
      slug: "zona-10",
      location: { lat: 14.6012, lng: -90.5146 },
      whatsapp: "5555-1010",
      accepts_delivery: true,
      delivery_fee: "15",
      delivery_radius_km: "5",
      min_order: "50",
      preorder_mode: "next_open",
      hours: hoursZona10,
    });
    const b = await create(id, {
      name: "Antigua",
      slug: "antigua",
      whatsapp: "+502 5555 2020",
      accepts_dine_in: false,
      preorder_mode: "off",
      hours: hoursAntigua,
    });

    const [zona10, antigua] = await Promise.all([getBranch(id, a.id), getBranch(id, b.id)]);
    expect(zona10).toMatchObject({
      lat: 14.6012,
      lng: -90.5146,
      whatsapp_e164: "+50255551010",
      accepts_delivery: true,
      delivery_fee_cents: 1500,
      delivery_radius_km: 5,
      min_order_cents: 5000,
      preorder_mode: "next_open",
    });
    expect(zona10?.hours).toHaveLength(6);
    expect(antigua).toMatchObject({
      whatsapp_e164: "+50255552020",
      accepts_dine_in: false,
      accepts_delivery: false,
      delivery_fee_cents: 0,
      preorder_mode: "off",
    });
    expect(antigua?.hours).toHaveLength(7);
    expect(antigua?.sort).toBe(1);
  });

  it("no repite el link de sucursal dentro del negocio", async () => {
    const { id } = await db().businesses.findUniqueOrThrow({
      where: { slug: `${PREFIX}-negocio` },
    });
    await expect(create(id, { name: "Otra", slug: "zona-10" })).rejects.toMatchObject({
      code: "slug_taken",
    });
  });

  it("respeta el límite: Pro incluye 1 sucursal", async () => {
    const { id } = await tempBusiness("pro", "pro");
    await create(id, { name: "Centro", slug: "centro", preorder_mode: "next_open" });
    await expect(create(id, { name: "Segunda", slug: "segunda" })).rejects.toBeInstanceOf(
      LimitExceededError,
    );
  });

  it("Gratis no activa pedidos fuera de horario", async () => {
    const { id } = await tempBusiness("gratis", "gratis");
    const error = await create(id, {
      name: "Única",
      slug: "unica",
      preorder_mode: "next_open",
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("feature_unavailable");
    await expect(
      create(id, { name: "Única", slug: "unica", preorder_mode: "off" }),
    ).resolves.toHaveProperty("id");
  });

  it("edita datos y horario, y registra la auditoría", async () => {
    const { id } = await db().businesses.findUniqueOrThrow({
      where: { slug: `${PREFIX}-negocio` },
    });
    const branch = await db().branches.findFirstOrThrow({
      where: { business_id: id, slug: "antigua" },
    });
    const entitlements = await getEntitlements(id);
    const parsed = branchFormSchema.parse(
      form(id, {
        branchId: branch.id,
        name: "Antigua Centro",
        slug: "antigua",
        whatsapp: "5555-2020",
        is_active: false,
        hours: defaultWeek(),
      }),
    );
    await updateBranchForBusiness({ ...parsed, branchId: branch.id }, { actorId, entitlements });

    const after = await getBranch(id, branch.id);
    expect(after).toMatchObject({ name: "Antigua Centro", is_active: false });
    expect(after?.hours).toHaveLength(6);
    const log = await db().audit_logs.findFirst({
      where: { entity_id: branch.id, action: "branch.update" },
      orderBy: { id: "desc" },
    });
    expect(log?.diff).toMatchObject({ name: ["Antigua", "Antigua Centro"], hours: "actualizado" });
  });
});
