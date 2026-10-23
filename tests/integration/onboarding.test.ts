import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessStepSchema, productsStepSchema } from "@/features/onboarding/schemas";
import {
  addFirstProducts,
  createBusinessFromOnboarding,
  getChecklistData,
  getOnboarding,
  progressOf,
  publishBusiness,
  setDefaultTemplate,
} from "@/features/onboarding/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/** QRM-039: asistente de alta (negocio nuevo → publicado con su QR). */

const SLUG = "zz-test-qrm039-cafe";
const userId = randomUUID();
let businessId: string;

const step1 = (over: Record<string, unknown> = {}) =>
  businessStepSchema.parse({
    name: "Café de Prueba",
    slug: SLUG,
    branchName: "Zona 10",
    address: "6a. avenida 12-34, zona 10",
    addressReference: "",
    city: "Guatemala",
    location: { lat: 14.6, lng: -90.51 },
    whatsapp: "5555-1234",
    ...over,
  });

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e as AppError,
  );

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { startsWith: "zz-test-qrm039" } } });
  // Sin FK a auth.users: basta el perfil para la membresía.
  await db().profiles.create({ data: { id: userId, full_name: "Prueba QRM-039" } });
});

afterAll(async () => {
  if (businessId) await db().audit_logs.deleteMany({ where: { business_id: businessId } });
  await db().businesses.deleteMany({ where: { slug: { startsWith: "zz-test-qrm039" } } });
  await db().profiles.deleteMany({ where: { id: userId } });
  await db().$disconnect();
});

describe("asistente de alta", () => {
  it("sin negocio: el paso 1 es el único posible", async () => {
    expect(await getOnboarding(userId)).toBeNull();
    expect(progressOf(null)).toEqual({
      hasBusiness: false,
      hasLogo: false,
      products: 0,
      published: false,
    });
  });

  it("el link ocupado o reservado se rechaza", async () => {
    const taken = await failure(
      createBusinessFromOnboarding(userId, step1({ slug: "cafe-el-portal" })),
    );
    expect(taken?.code).toBe("slug_taken");
    const reserved = await failure(createBusinessFromOnboarding(userId, step1({ slug: "panel" })));
    expect(reserved?.code).toBe("slug_reserved");
  });

  it("paso 1: negocio sin publicar, prueba de Pro, dueño, sucursal con horario y menú principal", async () => {
    ({ businessId } = await createBusinessFromOnboarding(userId, step1()));
    const biz = await db().businesses.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        published: true,
        theme: { select: { id: true } },
        license: {
          select: {
            plan_id: true,
            status: true,
            ends_at: true,
            events: { select: { type: true } },
          },
        },
        members: { select: { user_id: true, role: true } },
        branches: {
          select: {
            slug: true,
            whatsapp_e164: true,
            lat: true,
            hours: { select: { weekday: true } },
          },
        },
        menus: { select: { is_default: true, template: true } },
      },
    });
    expect(biz.published).toBe(false);
    expect(biz.theme).not.toBeNull();
    expect(biz.license).toMatchObject({
      plan_id: "pro",
      status: "trial",
      events: [{ type: "created" }],
    });
    const days = (biz.license!.ends_at.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13);
    expect(days).toBeLessThanOrEqual(14);
    expect(biz.members).toEqual([{ user_id: userId, role: "owner" }]);
    expect(biz.branches).toHaveLength(1);
    expect(biz.branches[0]).toMatchObject({
      slug: "zona-10",
      whatsapp_e164: "+50255551234",
      lat: 14.6,
    });
    // Lunes a sábado.
    expect(biz.branches[0]!.hours.map((h) => h.weekday).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(biz.menus).toEqual([{ is_default: true, template: "clasico" }]);
    expect(progressOf(await getOnboarding(userId))).toMatchObject({
      hasBusiness: true,
      products: 0,
    });
  });

  it("volver al paso 1 corrige el mismo negocio (no crea otro)", async () => {
    const again = await createBusinessFromOnboarding(
      userId,
      step1({ name: "Café de Prueba 2", slug: `${SLUG}-2`, whatsapp: "5555-9999" }),
    );
    expect(again.businessId).toBe(businessId);
    expect(await db().business_members.count({ where: { user_id: userId } })).toBe(1);
    const o = await getOnboarding(userId);
    expect(o).toMatchObject({ name: "Café de Prueba 2", slug: `${SLUG}-2` });
    expect(o?.branch?.whatsapp_e164).toBe("+50255559999");
  });

  it("paso 2: la plantilla del menú principal (respeta el plan)", async () => {
    await setDefaultTemplate(businessId, "tarjetas", { allTemplates: true });
    expect((await getOnboarding(userId))?.menu?.template).toBe("tarjetas");
    const locked = await failure(
      setDefaultTemplate(businessId, "galeria", { allTemplates: false }),
    );
    expect(locked?.code).toBe("feature_unavailable");
  });

  it("publicar sin productos no se puede", async () => {
    const error = await failure(publishBusiness(businessId, { actorId: userId }));
    expect(error?.code).toBe("no_products");
  });

  it("paso 3: productos en el menú principal, en «Lo más pedido», el primero destacado", async () => {
    const input = productsStepSchema.parse({
      businessId,
      products: [
        { name: "Café americano", price: "15", imageUrl: null, imageBlurhash: null },
        { name: "Desayuno chapín", price: "45.50", imageUrl: null, imageBlurhash: null },
      ],
    });
    expect(await addFirstProducts(input, { actorId: userId })).toEqual({ created: 2 });
    const menu = await db().menus.findFirstOrThrow({
      where: { business_id: businessId, is_default: true },
      select: {
        sections: {
          select: {
            name: true,
            items: {
              orderBy: { sort: "asc" },
              select: { is_featured: true, product: { select: { name: true, price_cents: true } } },
            },
          },
        },
      },
    });
    expect(menu.sections).toEqual([
      {
        name: "Lo más pedido",
        items: [
          { is_featured: true, product: { name: "Café americano", price_cents: 1500 } },
          { is_featured: false, product: { name: "Desayuno chapín", price_cents: 4550 } },
        ],
      },
    ]);
    // Una foto ajena se rechaza.
    const foreign = await failure(
      addFirstProducts(
        productsStepSchema.parse({
          businessId,
          products: [
            {
              name: "Pan",
              price: "5",
              imageUrl: "https://example.com/foto.webp",
              imageBlurhash: null,
            },
          ],
        }),
        { actorId: userId },
      ),
    );
    expect(foreign?.code).toBe("forbidden");
  });

  it("paso 4: publica, crea el QR de la sucursal una sola vez y registra los minutos", async () => {
    await publishBusiness(businessId, { actorId: userId });
    await publishBusiness(businessId, { actorId: userId });
    const o = await getOnboarding(userId);
    expect(progressOf(o)).toMatchObject({ published: true, products: 2 });
    const qrs = await db().qr_codes.findMany({
      where: { business_id: businessId },
      select: { label: true, table_label: true },
    });
    expect(qrs).toEqual([{ label: "Sucursal", table_label: null }]);
    const logs = await db().audit_logs.findMany({
      where: { business_id: businessId, action: "business.publish" },
      select: { diff: true },
    });
    expect(logs).toHaveLength(1);
    expect(
      (logs[0]!.diff as { minutes_to_publish: number }).minutes_to_publish,
    ).toBeGreaterThanOrEqual(0);
  });

  it("lista final: horario estándar sin tocar, sin cuentas ni avisos ni equipo", async () => {
    expect(await getChecklistData(businessId)).toEqual({
      hoursCustomized: false,
      products: 2,
      bankAccounts: 0,
      pushDevices: 0,
      teamMembers: 0,
    });
  });
});
