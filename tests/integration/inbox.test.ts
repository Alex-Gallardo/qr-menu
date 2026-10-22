import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listInboxOrders, updateOrderStatus } from "@/features/orders/inbox";
import { createOrderSchema } from "@/features/orders/schemas";
import { createOrder } from "@/features/orders/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { gtInstant, todayInGuatemala } from "@/lib/gt-time";

/**
 * QRM-030: la bandeja en tiempo real. Realtime entrega los cambios de
 * `orders` filtrados por RLS (can_see_branch): aquí se comprueba esa misma
 * política con el usuario de la sesión, y el cambio de estado.
 */

const DEMO = "cafe-el-portal";
const SLUG = "zz-test-qrm030";
const NOON = gtInstant(todayInGuatemala(), 12 * 60);

/** Cuenta pedidos como lo haría Realtime para ese usuario (rol authenticated + RLS). */
async function visibleCount(userId: string, branchId: string) {
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    const rows = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM public.orders WHERE branch_id = ${branchId}::uuid`;
    return rows[0]!.n;
  });
}

describe("RLS de la bandeja (lo que filtra Realtime)", () => {
  it("el encargado de Antigua ve los pedidos de Antigua y ninguno de Zona 1; el dueño ve ambos", async () => {
    const business = await db().businesses.findUniqueOrThrow({
      where: { slug: DEMO },
      select: {
        branches: { select: { id: true, slug: true } },
        members: {
          select: {
            user_id: true,
            role: true,
            all_branches: true,
            branches: { select: { branch: { select: { slug: true } } } },
          },
        },
      },
    });
    const zona1 = business.branches.find((b) => b.slug === "zona-1")!.id;
    const antigua = business.branches.find((b) => b.slug === "antigua")!.id;
    const manager = business.members.find(
      (m) =>
        m.role === "manager" &&
        !m.all_branches &&
        m.branches.some((b) => b.branch.slug === "antigua"),
    )!;
    const owner = business.members.find((m) => m.role === "owner")!;
    const total = (id: string) => db().orders.count({ where: { branch_id: id } });

    expect(await visibleCount(manager.user_id, antigua)).toBe(await total(antigua));
    expect(await visibleCount(manager.user_id, zona1)).toBe(0);
    expect(await visibleCount(owner.user_id, zona1)).toBe(await total(zona1));
    expect(await visibleCount(owner.user_id, antigua)).toBe(await total(antigua));
    // Alguien que no es del negocio no ve nada.
    expect(await visibleCount("00000000-0000-4000-8000-000000000000", zona1)).toBe(0);
  });
});

describe("estados del pedido", () => {
  let branchA: string;
  let branchB: string;
  let businessId: string;
  let productId: string;

  const place = (branchId: string) =>
    createOrder(
      createOrderSchema.parse({
        branchId,
        clientSessionId: `${SLUG}-${Math.random().toString(36).slice(2, 10)}`,
        items: [{ productId, quantity: 1 }],
        orderType: "takeout",
        name: "María López",
        payment: "cash",
      }),
      { now: NOON },
    );

  beforeAll(async () => {
    await db().businesses.deleteMany({ where: { slug: SLUG } });
    const hours = {
      create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        opens: "07:00",
        closes: "21:00",
      })),
    };
    const biz = await db().businesses.create({
      data: {
        slug: SLUG,
        name: "Prueba QRM-030",
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
    productId = biz.products[0]!.id;
    await db().menus.create({
      data: {
        business_id: biz.id,
        name: "Carta",
        is_default: true,
        sections: { create: { name: "Todo", items: { create: { product_id: productId } } } },
      },
    });
  });

  afterAll(async () => {
    await db().businesses.deleteMany({ where: { slug: SLUG } });
    await db().rate_limits.deleteMany({ where: { key: { startsWith: `order:session:${SLUG}` } } });
  });

  it("la bandeja de una sucursal no trae pedidos de otra", async () => {
    const a = await place(branchA);
    const b = await place(branchB);
    const inboxA = await listInboxOrders([branchA]);
    expect(inboxA.map((o) => o.id)).toContain(a.id);
    expect(inboxA.map((o) => o.id)).not.toContain(b.id);
    expect(inboxA.find((o) => o.id === a.id)).toMatchObject({
      status: "new",
      summary: "1× Pepián",
    });
  });

  it("nuevo → aceptado → listo → entregado, con historial", async () => {
    const order = await place(branchA);
    for (const to of ["accepted", "ready", "delivered"] as const)
      await updateOrderStatus(businessId, order.id, to, {});
    const events = await db().order_status_events.findMany({
      where: { order_id: order.id },
      orderBy: { created_at: "asc" },
      select: { status: true },
    });
    expect(events.map((e) => e.status)).toEqual(["new", "accepted", "ready", "delivered"]);
    await expect(updateOrderStatus(businessId, order.id, "cancelled", {})).rejects.toThrow(
      AppError,
    );
  });

  it("dos tablets aceptan a la vez: solo una gana", async () => {
    const order = await place(branchA);
    const results = await Promise.allSettled([
      updateOrderStatus(businessId, order.id, "accepted", {}),
      updateOrderStatus(businessId, order.id, "accepted", {}),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const events = await db().order_status_events.count({
      where: { order_id: order.id, status: "accepted" },
    });
    expect(events).toBe(1);
  });

  it("no se puede cambiar un pedido de otro negocio", async () => {
    const order = await place(branchA);
    await expect(
      updateOrderStatus("00000000-0000-4000-8000-000000000000", order.id, "accepted", {}),
    ).rejects.toThrow("Ese pedido ya no existe.");
  });
});
