import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sendOrderConfirmation } from "@/features/orders/confirmation";
import { createOrderSchema } from "@/features/orders/schemas";
import { createOrder } from "@/features/orders/server";
import { db } from "@/lib/db";
import { gtInstant, todayInGuatemala } from "@/lib/gt-time";

/**
 * QRM-029: correo de confirmación solo al comensal que dejó su correo; nunca
 * al negocio; sin llave no se envía; no se manda dos veces; si falla, se reintenta.
 */

const SLUG = "zz-test-qrm029";
const NOON = gtInstant(todayInGuatemala(), 12 * 60);
const BUSINESS_EMAIL = "dueno@negocio.test";
let branchId: string;
let productId: string;

const place = (email = "") =>
  createOrder(
    createOrderSchema.parse({
      branchId,
      clientSessionId: `${SLUG}-${Math.random().toString(36).slice(2, 10)}`,
      items: [{ productId, quantity: 1 }],
      orderType: "takeout",
      name: "María López",
      email,
      payment: "cash",
    }),
    { now: NOON },
  );

const sentAt = async (id: string) =>
  (await db().orders.findUniqueOrThrow({ where: { id }, select: { confirmation_sent_at: true } }))
    .confirmation_sent_at;

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-029",
      email: BUSINESS_EMAIL,
      license: {
        create: {
          plan_id: "pro",
          status: "active",
          ends_at: new Date(Date.now() + 30 * 86_400_000),
        },
      },
      branches: {
        create: {
          slug: "centro",
          name: "Centro",
          whatsapp_e164: "+50255550000",
          hours: {
            create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              opens: "07:00",
              closes: "21:00",
            })),
          },
        },
      },
      products: { create: { name: "Pepián", price_cents: 3500 } },
    },
    select: { id: true, branches: { select: { id: true } }, products: { select: { id: true } } },
  });
  branchId = biz.branches[0]!.id;
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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().rate_limits.deleteMany({ where: { key: { startsWith: `order:session:${SLUG}` } } });
});

describe("correo de confirmación", () => {
  it("sin correo del comensal no se envía nada", async () => {
    vi.stubEnv("RESEND_API_KEY", "x".repeat(24));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const order = await place();
    expect(await sendOrderConfirmation(order.id)).toEqual({ sent: false, reason: "no_email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin RESEND_API_KEY no se envía y queda pendiente", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const order = await place("maria@correo.test");
    expect(await sendOrderConfirmation(order.id)).toEqual({ sent: false, reason: "disabled" });
    expect(await sentAt(order.id)).toBeNull();
  });

  it("se envía solo al comensal (nunca al negocio), una sola vez", async () => {
    vi.stubEnv("RESEND_API_KEY", "x".repeat(24));
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ id: "re_123" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const order = await place("  Maria@Correo.test ");

    expect(await sendOrderConfirmation(order.id)).toEqual({ sent: true, id: "re_123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.to).toEqual(["maria@correo.test"]);
    expect(JSON.stringify(body.to)).not.toContain(BUSINESS_EMAIL);
    expect(body.reply_to).toBe(BUSINESS_EMAIL);
    expect(body.subject).toBe(
      `Recibimos tu pedido #${String(order.number).padStart(4, "0")} en Prueba QRM-029 · Centro`,
    );
    expect(body.html).toContain("Pepián");
    expect(await sentAt(order.id)).not.toBeNull();

    expect(await sendOrderConfirmation(order.id)).toEqual({ sent: false, reason: "already_sent" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si Resend falla, queda pendiente para reintentar", async () => {
    vi.stubEnv("RESEND_API_KEY", "x".repeat(24));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("caído", { status: 503 })));
    const order = await place("maria@correo.test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendOrderConfirmation(order.id)).toEqual({ sent: false, reason: "error" });
    expect(await sentAt(order.id)).toBeNull();
  });
});
