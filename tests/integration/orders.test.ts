import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrderSchema, type CreateOrderInput } from "@/features/orders/schemas";
import { createOrder, ORDER_LIMITS } from "@/features/orders/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { addDays, gtInstant, todayInGuatemala } from "@/lib/gt-time";

/**
 * QRM-027 ★ createOrder: consecutivo por sucursal con 50 pedidos simultáneos,
 * precio manipulado ignorado, disponibilidad, cobertura, horario y límites.
 */

const SLUG = "zz-test-qrm027";
const SESSION = "zz-test-qrm027";
const TODAY = todayInGuatemala();
const NOON = gtInstant(TODAY, 12 * 60);
const NIGHT = gtInstant(TODAY, 22 * 60);
const CENTRO = { lat: 14.6427, lng: -90.5133 };

let branchId: string;
let ids: Record<"pepian" | "horchata" | "tamal" | "rellenitos", string>;
let grande: string;
let chico: string;

const order = (over: Record<string, unknown> = {}): CreateOrderInput =>
  createOrderSchema.parse({
    branchId,
    clientSessionId: `${SESSION}-${Math.random().toString(36).slice(2, 10)}`,
    items: [{ productId: ids.pepian, quantity: 1 }],
    orderType: "takeout",
    name: "María López",
    phone: "5555-1234",
    payment: "cash",
    ...over,
  });

async function rejects(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error.userMessage;
    throw error;
  }
  throw new Error("Se esperaba un rechazo");
}

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-027",
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
          ...CENTRO,
          accepts_delivery: true,
          delivery_radius_km: 5,
          delivery_fee_cents: 1500,
          delivery_requires_location: true,
          preorder_mode: "next_open",
          preorder_min_lead_min: 30,
          preorder_max_days: 2,
          hours: {
            create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              opens: "07:00",
              closes: "21:00",
            })),
          },
        },
      },
    },
    select: { id: true, branches: { select: { id: true } } },
  });
  branchId = biz.branches[0]!.id;

  const product = (name: string, price_cents: number) =>
    db().products.create({
      data: { business_id: biz.id, name, price_cents },
      select: { id: true },
    });
  const [pepian, horchata, tamal, rellenitos] = await Promise.all([
    product("Pepián", 3000),
    product("Horchata", 1000),
    product("Tamal", 1500),
    product("Rellenitos", 1200),
  ]);
  ids = { pepian: pepian.id, horchata: horchata.id, tamal: tamal.id, rellenitos: rellenitos.id };

  // Pepián: Q35 en esta sucursal (gana al especial del menú). Tamal: agotado aquí.
  await db().branch_products.createMany({
    data: [
      { branch_id: branchId, product_id: ids.pepian, price_override_cents: 3500 },
      { branch_id: branchId, product_id: ids.tamal, is_available: false },
    ],
  });
  const group = await db().product_option_groups.create({
    data: {
      product_id: ids.horchata,
      name: "Tamaño",
      min_select: 1,
      max_select: 1,
      options: {
        create: [
          { name: "Chico", price_delta_cents: 0, sort: 0 },
          { name: "Grande", price_delta_cents: 500, sort: 1 },
        ],
      },
    },
    select: { options: { orderBy: { sort: "asc" }, select: { id: true } } },
  });
  [chico, grande] = group.options.map((o) => o.id) as [string, string];

  // Menú predeterminado: Horchata a Q9 en este menú; Rellenitos no está en ningún menú.
  await db().menus.create({
    data: {
      business_id: biz.id,
      name: "Carta",
      is_default: true,
      sections: {
        create: {
          name: "Todo",
          items: {
            create: [
              { product_id: ids.pepian, price_override_cents: 2800, sort: 0 },
              { product_id: ids.horchata, price_override_cents: 900, sort: 1 },
              { product_id: ids.tamal, sort: 2 },
            ],
          },
        },
      },
    },
  });
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().rate_limits.deleteMany({ where: { key: { startsWith: `order:session:${SESSION}` } } });
});

describe("createOrder", () => {
  it("guarda el pedido con precios del servidor: un precio manipulado se ignora", async () => {
    const input = createOrderSchema.parse({
      ...order(),
      items: [
        { productId: ids.pepian, quantity: 2, priceCents: 1, unitCents: 1 },
        { productId: ids.horchata, optionIds: [grande], quantity: 1, note: " sin hielo " },
      ],
      totalCents: 100,
      orderType: "dine_in",
      table: "Mesa 4",
    });
    expect(input.items[0]).not.toHaveProperty("priceCents");

    const created = await createOrder(input, { now: NOON });
    expect(created).toMatchObject({ number: 1, total_cents: 3500 * 2 + 900 + 500 });

    const saved = await db().orders.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: { orderBy: { name_snapshot: "asc" } }, events: true },
    });
    expect(saved).toMatchObject({
      order_type: "dine_in",
      table_label: "Mesa 4",
      customer_phone: "+50255551234",
      subtotal_cents: 8400,
      delivery_fee_cents: 0,
      status: "new",
    });
    expect(saved.items).toMatchObject([
      {
        name_snapshot: "Horchata",
        unit_price_cents: 1400,
        quantity: 1,
        notes: "sin hielo",
        options_snapshot: [{ group: "Tamaño", name: "Grande", deltaCents: 500 }],
      },
      { name_snapshot: "Pepián", unit_price_cents: 3500, quantity: 2, line_total_cents: 7000 },
    ]);
    expect(saved.events.map((e) => e.status)).toEqual(["new"]);
  });

  it("50 pedidos simultáneos: números consecutivos sin repetir", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => createOrder(order(), { now: NOON })),
    );
    const numbers = results.map((r) => r.number).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(50);
    expect(numbers[0]).toBe(2);
    expect(numbers.at(-1)).toBe(51);
    const branch = await db().branches.findUniqueOrThrow({
      where: { id: branchId },
      select: { next_order_number: true },
    });
    expect(branch.next_order_number).toBe(52);
  }, 120_000);

  it("agotado aquí o fuera del menú: se rechaza diciendo cuál", async () => {
    expect(
      await rejects(
        createOrder(order({ items: [{ productId: ids.tamal, quantity: 1 }] }), { now: NOON }),
      ),
    ).toBe("Revisa tu pedido: Tamal (se nos acabó). Quítalo para continuar.");
    expect(
      await rejects(
        createOrder(order({ items: [{ productId: ids.rellenitos, quantity: 1 }] }), { now: NOON }),
      ),
    ).toContain("Rellenitos (ya no está en el menú)");
  });

  it("opciones que no son del producto o falta un obligatorio", async () => {
    expect(
      await rejects(
        createOrder(order({ items: [{ productId: ids.horchata, quantity: 1 }] }), { now: NOON }),
      ),
    ).toContain("Horchata (Elige tu tamaño.)");
    expect(
      await rejects(
        createOrder(
          order({ items: [{ productId: ids.pepian, optionIds: [chico], quantity: 1 }] }),
          {
            now: NOON,
          },
        ),
      ),
    ).toContain("Una de las opciones ya no existe.");
  });

  it("a domicilio: guarda ubicación y distancia; fuera de cobertura se rechaza", async () => {
    const delivery = (coords: { lat: number; lng: number }) =>
      order({
        orderType: "delivery",
        address: "4a avenida 12-30, zona 1",
        addressReference: "Portón negro",
        location: { coords, accuracyM: 20, source: "gps" },
        items: [{ productId: ids.pepian, quantity: 2 }],
      });
    const ok = await createOrder(delivery({ lat: 14.6227, lng: -90.5133 }), { now: NOON });
    const saved = await db().orders.findUniqueOrThrow({ where: { id: ok.id } });
    expect(saved).toMatchObject({
      delivery_fee_cents: 1500,
      total_cents: 8500,
      location_source: "gps",
      distance_km: 2.22,
      delivery_lat: 14.6227,
    });
    expect(
      await rejects(createOrder(delivery({ lat: 14.6331, lng: -90.6064 }), { now: NOON })),
    ).toBe("Estás a 10.1 km y esta sucursal entrega hasta 5 km.");
  });

  it("cerrada: lo antes posible se rechaza; un horario ofrecido se acepta", async () => {
    expect(await rejects(createOrder(order(), { now: NIGHT }))).toBe(
      "Elige para cuándo quieres tu pedido.",
    );
    const at = gtInstant(addDays(TODAY, 1), 7 * 60 + 30).toISOString();
    const scheduled = await createOrder(order({ scheduledFor: at }), { now: NIGHT });
    expect(scheduled.scheduled_for?.toISOString()).toBe(at);
    expect(
      await rejects(
        createOrder(order({ scheduledFor: gtInstant(addDays(TODAY, 1), 3 * 60).toISOString() }), {
          now: NIGHT,
        }),
      ),
    ).toBe("Ese horario ya no está disponible. Elige otro.");
  });

  it(`límite por dispositivo: ${ORDER_LIMITS.session.limit} pedidos cada 10 minutos`, async () => {
    const clientSessionId = `${SESSION}-limite`;
    for (let i = 0; i < ORDER_LIMITS.session.limit; i++)
      await createOrder(order({ clientSessionId }), { now: NOON });
    expect(await rejects(createOrder(order({ clientSessionId }), { now: NOON }))).toMatch(
      /^Ya enviaste varios pedidos seguidos\. Intenta de nuevo en \d+ minutos?\.$/,
    );
  });

  it("sucursal en pausa: no recibe pedidos", async () => {
    await db().branches.update({ where: { id: branchId }, data: { is_active: false } });
    try {
      expect(await rejects(createOrder(order(), { now: NOON }))).toBe(
        "Esta sucursal no recibe pedidos por ahora.",
      );
    } finally {
      await db().branches.update({ where: { id: branchId }, data: { is_active: true } });
    }
  });
});
