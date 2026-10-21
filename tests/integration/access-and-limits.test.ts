import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertWithinLimit, getEntitlements, getUsage } from "@/features/licensing/server";
import { assertAccess } from "@/lib/auth/access";
import { getMembership } from "@/lib/auth/require-access";
import { db } from "@/lib/db";
import { AccessError, LimitExceededError } from "@/lib/errors";

/**
 * Criterios de QRM-008 contra la base real (datos del seed):
 *  - un encargado no ve otra sucursal;
 *  - una licencia Gratis no crea una 2.ª sucursal.
 */

const TEMP_SLUG = "zz-test-qrm008";
const DAY = 24 * 60 * 60 * 1000;

let demo: {
  id: string;
  zona1: string;
  antigua: string;
  managerUserId: string;
  ownerUserId: string;
};

async function createTempBusiness(license: {
  plan_id: string;
  status: "trial" | "active";
  ends_at: Date;
}) {
  await db().businesses.deleteMany({ where: { slug: TEMP_SLUG } });
  return db().businesses.create({
    data: {
      slug: TEMP_SLUG,
      name: "Prueba QRM-008",
      license: { create: license },
      branches: { create: { slug: "centro", name: "Centro", whatsapp_e164: "+50200000000" } },
    },
    select: { id: true },
  });
}

beforeAll(async () => {
  const business = await db().businesses.findUnique({
    where: { slug: "cafe-el-portal" },
    select: {
      id: true,
      branches: { select: { id: true, slug: true } },
      members: { select: { user_id: true, role: true } },
    },
  });
  if (!business) throw new Error("Falta el negocio demo: corre `pnpm db:seed` primero.");
  const branch = (slug: string) => business.branches.find((b) => b.slug === slug)!.id;
  demo = {
    id: business.id,
    zona1: branch("zona-1"),
    antigua: branch("antigua"),
    managerUserId: business.members.find((m) => m.role === "manager")!.user_id,
    ownerUserId: business.members.find((m) => m.role === "owner")!.user_id,
  };
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: TEMP_SLUG } });
  await db().$disconnect();
});

describe("acceso por sucursal (datos del seed)", () => {
  it("el encargado de Antigua no ve Zona 1 y sí ve Antigua", async () => {
    const [member, entitlements] = await Promise.all([
      getMembership(demo.managerUserId, demo.id),
      getEntitlements(demo.id),
    ]);
    expect(member).toMatchObject({
      role: "manager",
      allBranches: false,
      branchIds: [demo.antigua],
    });

    expect(() => assertAccess(member, entitlements, { branchId: demo.zona1 })).toThrow(AccessError);
    expect(() => assertAccess(member, entitlements, { branchId: demo.antigua })).not.toThrow();
  });

  it("el encargado no hace cosas solo del dueño; el dueño ve ambas sucursales", async () => {
    const [manager, owner, entitlements] = await Promise.all([
      getMembership(demo.managerUserId, demo.id),
      getMembership(demo.ownerUserId, demo.id),
      getEntitlements(demo.id),
    ]);
    expect(() => assertAccess(manager, entitlements, { roles: ["owner"] })).toThrow(AccessError);
    expect(() => assertAccess(owner, entitlements, { branchId: demo.zona1 })).not.toThrow();
    expect(() => assertAccess(owner, entitlements, { branchId: demo.antigua })).not.toThrow();
  });

  it("un usuario sin membresía no entra a un negocio ajeno", async () => {
    const outsider = await getMembership(
      demo.managerUserId,
      "00000000-0000-4000-8000-000000000000",
    );
    expect(outsider).toBeNull();
    expect(await getMembership(demo.managerUserId, "no-es-uuid")).toBeNull();
  });
});

describe("límites de licencia", () => {
  it("el demo (Negocio en prueba) puede tener 3 sucursales: tiene 2", async () => {
    const entitlements = await getEntitlements(demo.id);
    expect(entitlements).toMatchObject({ status: "trial", planId: "negocio" });
    expect(await getUsage(demo.id, "branches")).toBe(2);
    await expect(assertWithinLimit(demo.id, "branches")).resolves.toMatchObject({ ok: true });
    await expect(assertWithinLimit(demo.id, "branches", 2)).rejects.toThrow(LimitExceededError);
  });

  it("Gratis no crea una 2.ª sucursal", async () => {
    const business = await createTempBusiness({
      plan_id: "gratis",
      status: "active",
      ends_at: new Date(Date.now() + 365 * DAY),
    });
    const error = await assertWithinLimit(business.id, "branches").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LimitExceededError);
    expect((error as LimitExceededError).userMessage).toBe(
      "Tu plan incluye 1 sucursal. Pasa a Negocio para agregar más.",
    );
  });

  it("una prueba Pro vencida baja a Gratis y aplica sus límites", async () => {
    const business = await createTempBusiness({
      plan_id: "pro",
      status: "trial",
      ends_at: new Date(Date.now() - DAY),
    });
    const entitlements = await getEntitlements(business.id);
    expect(entitlements).toMatchObject({ status: "free", planId: "gratis", licensedPlanId: "pro" });
    await expect(assertWithinLimit(business.id, "managers")).rejects.toThrow(LimitExceededError);
  });
});
