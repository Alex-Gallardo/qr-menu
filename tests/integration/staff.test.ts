import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrderSchema } from "@/features/orders/schemas";
import { createOrder } from "@/features/orders/server";
import {
  authorizeDevice,
  endStaffSession,
  getStaffSession,
  revokeDevice,
  startStaffSession,
  verifyStaffPin,
} from "@/features/staff/server";
import { db } from "@/lib/db";
import { gtInstant, todayInGuatemala } from "@/lib/gt-time";

/**
 * QRM-031 ★ staff con PIN: el PIN no funciona en un dispositivo no autorizado
 * (ni en otra sucursal); 5 fallos bloquean 5 minutos; el turno solo ve su
 * sucursal (RLS, lo mismo que filtra Realtime).
 */

const SLUG = "zz-test-qrm031";
const FREE_SLUG = "zz-test-qrm031-gratis";
const NOON = gtInstant(todayInGuatemala(), 12 * 60);
let businessId: string;
let branchA: string;
let branchB: string;
let tokenA: string;
let deviceA: string;
let freeToken: string;
const deviceIds: string[] = [];

const hours = {
  create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "07:00", closes: "21:00" })),
};

async function visibleCount(userId: string, branchId: string) {
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated", is_anonymous: true })}, true)`;
    await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    const rows = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM public.orders WHERE branch_id = ${branchId}::uuid`;
    return rows[0]!.n;
  });
}

const failures = (deviceId: string) =>
  db().rate_limits.findUnique({ where: { key: `pin:device:${deviceId}` } });

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, FREE_SLUG] } } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-031",
      license: {
        create: {
          plan_id: "pro",
          status: "active",
          ends_at: new Date(Date.now() + 30 * 86_400_000),
        },
      },
      branches: {
        create: [
          { slug: "a", name: "A", whatsapp_e164: "+50255550000", hours },
          { slug: "b", name: "B", whatsapp_e164: "+50255550001", hours },
        ],
      },
      products: { create: { name: "Pepián", price_cents: 3500 } },
    },
    select: {
      id: true,
      branches: { select: { id: true, slug: true } },
      products: { select: { id: true } },
    },
  });
  businessId = biz.id;
  branchA = biz.branches.find((b) => b.slug === "a")!.id;
  branchB = biz.branches.find((b) => b.slug === "b")!.id;
  const productId = biz.products[0]!.id;
  await db().staff_members.createMany({
    data: [
      {
        business_id: businessId,
        branch_id: branchA,
        display_name: "Rosa - caja",
        pin_hash: await bcrypt.hash("2468", 10),
      },
      {
        business_id: businessId,
        branch_id: branchB,
        display_name: "Luis - cocina",
        pin_hash: await bcrypt.hash("1357", 10),
      },
    ],
  });
  await db().menus.create({
    data: {
      business_id: businessId,
      name: "Carta",
      is_default: true,
      sections: { create: { name: "Todo", items: { create: { product_id: productId } } } },
    },
  });
  for (const branchId of [branchA, branchB])
    await createOrder(
      createOrderSchema.parse({
        branchId,
        clientSessionId: `${SLUG}-${randomUUID().slice(0, 8)}`,
        items: [{ productId, quantity: 1 }],
        orderType: "takeout",
        name: "María López",
        payment: "cash",
      }),
      { now: NOON },
    );

  const device = await authorizeDevice({
    businessId,
    branchId: branchA,
    name: "Tablet de caja",
    approvedBy: randomUUID(),
  });
  tokenA = device.token;
  deviceA = device.deviceId;
  deviceIds.push(deviceA);

  // Negocio en plan Gratis (sin "staff con PIN").
  const free = await db().businesses.create({
    data: {
      slug: FREE_SLUG,
      name: "Prueba QRM-031 gratis",
      branches: { create: { slug: "centro", name: "Centro", whatsapp_e164: "+50255550002" } },
    },
    select: { id: true, branches: { select: { id: true } } },
  });
  await db().staff_members.create({
    data: {
      business_id: free.id,
      branch_id: free.branches[0]!.id,
      display_name: "Ana",
      pin_hash: await bcrypt.hash("9999", 10),
    },
  });
  const freeDevice = await authorizeDevice({
    businessId: free.id,
    branchId: free.branches[0]!.id,
    name: "Celular",
    approvedBy: randomUUID(),
  });
  freeToken = freeDevice.token;
  deviceIds.push(freeDevice.deviceId);
});

afterAll(async () => {
  await db().rate_limits.deleteMany({
    where: {
      OR: [
        { key: { in: deviceIds.map((id) => `pin:device:${id}`) } },
        { key: { startsWith: `order:session:${SLUG}` } },
      ],
    },
  });
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, FREE_SLUG] } } });
});

describe("PIN del staff", () => {
  it("no funciona en un dispositivo no autorizado", async () => {
    const msg = "Este dispositivo no está autorizado. Pide al dueño o encargado que lo autorice.";
    expect(await verifyStaffPin(undefined, "2468")).toEqual({ ok: false, message: msg });
    expect(await verifyStaffPin("token-inventado", "2468")).toEqual({ ok: false, message: msg });
  });

  it("el PIN de otra sucursal no abre turno en esta tablet", async () => {
    expect(await verifyStaffPin(tokenA, "1357")).toEqual({
      ok: false,
      message: "PIN incorrecto. Te quedan 4 intentos.",
    });
  });

  it("el PIN correcto abre turno y borra los fallos", async () => {
    const result = await verifyStaffPin(tokenA, "2468");
    expect(result).toMatchObject({
      ok: true,
      staff: { name: "Rosa - caja" },
      device: { id: deviceA },
    });
    expect(await failures(deviceA)).toBeNull();
  });

  it("5 fallos bloquean 5 minutos (ni el PIN correcto entra); después vuelve a funcionar", async () => {
    const messages: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await verifyStaffPin(tokenA, "0000");
      messages.push(r.ok ? "ok" : r.message);
    }
    expect(messages.slice(0, 4)).toEqual([
      "PIN incorrecto. Te quedan 4 intentos.",
      "PIN incorrecto. Te quedan 3 intentos.",
      "PIN incorrecto. Te quedan 2 intentos.",
      "PIN incorrecto. Te queda 1 intento.",
    ]);
    expect(messages[4]).toBe("Demasiados intentos. Espera 5 minutos y vuelve a probar.");
    expect(await verifyStaffPin(tokenA, "2468")).toMatchObject({
      ok: false,
      message: expect.stringMatching(/^Demasiados intentos/),
    });

    // Pasan los 5 minutos.
    await db()
      .$executeRaw`UPDATE rate_limits SET window_start = now() - interval '6 minutes' WHERE key = ${`pin:device:${deviceA}`}`;
    expect(await verifyStaffPin(tokenA, "2468")).toMatchObject({ ok: true });
  });

  it("formato del PIN y plan sin la función", async () => {
    expect(await verifyStaffPin(tokenA, "12")).toEqual({
      ok: false,
      message: "El PIN tiene de 4 a 6 dígitos.",
    });
    expect(await verifyStaffPin(freeToken, "9999")).toEqual({
      ok: false,
      message: "El staff con PIN no está disponible en el plan de este negocio.",
    });
  });
});

describe("turno del staff", () => {
  it("solo ve los pedidos de su sucursal, en su dispositivo, hasta cerrar turno", async () => {
    const verified = await verifyStaffPin(tokenA, "2468");
    if (!verified.ok) throw new Error(verified.message);
    const authUserId = randomUUID();
    await startStaffSession(authUserId, verified.staff.id, verified.device);

    expect(await getStaffSession(authUserId, tokenA)).toMatchObject({
      branch_id: branchA,
      staff: { display_name: "Rosa - caja" },
    });
    // La sesión no sirve con la cookie de otro dispositivo.
    expect(await getStaffSession(authUserId, freeToken)).toBeNull();

    expect(await visibleCount(authUserId, branchA)).toBe(1);
    expect(await visibleCount(authUserId, branchB)).toBe(0);

    await endStaffSession(authUserId);
    expect(await getStaffSession(authUserId, tokenA)).toBeNull();
    expect(await visibleCount(authUserId, branchA)).toBe(0);
  });

  it("revocar el dispositivo termina sus turnos y el PIN ya no funciona", async () => {
    const verified = await verifyStaffPin(tokenA, "2468");
    if (!verified.ok) throw new Error(verified.message);
    const authUserId = randomUUID();
    await startStaffSession(authUserId, verified.staff.id, verified.device);
    await revokeDevice(businessId, deviceA);
    expect(await getStaffSession(authUserId, tokenA)).toBeNull();
    expect(await verifyStaffPin(tokenA, "2468")).toMatchObject({ ok: false });
  });
});
