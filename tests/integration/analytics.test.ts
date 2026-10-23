import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { funnel } from "@/features/analytics/metrics";
import { eventBatchSchema } from "@/features/analytics/schemas";
import {
  getBranchSummaries,
  getBreakdown,
  getDailyRows,
  getSummary,
  recordEvents,
} from "@/features/analytics/server";
import { db } from "@/lib/db";

/** QRM-038: analíticas con filtro por sucursal; el embudo cuadra con la base. */

const DAY = 24 * 60 * 60 * 1000;
const SLUG = "zz-test-qrm038-analiticas";
const OTHER = "zz-test-qrm038-otro";
let businessId: string;
let otherBusinessId: string;
let centro: string;
let norte: string;
let cafe: string;
let pan: string;
let qrMesa: string;
let nextNumber = 1;
// Ventana del periodo: la última hora (los eventos usan el reloj de la base).
const range = () => ({
  from: new Date(Date.now() - 60 * 60 * 1000),
  to: new Date(Date.now() + 10 * 60_000),
});

const batch = (raw: Record<string, unknown>) => eventBatchSchema.parse(raw);

async function order(
  branchId: string,
  opts: {
    status?: "new" | "delivered" | "cancelled";
    session?: string;
    type?: "takeout" | "delivery";
    scheduled?: boolean;
    totalCents: number;
    items: { productId: string; name: string; qty: number }[];
  },
) {
  return db().orders.create({
    data: {
      business_id: businessId,
      branch_id: branchId,
      number: nextNumber++,
      customer_name: "Ana",
      order_type: opts.type ?? "takeout",
      payment_method: "cash",
      subtotal_cents: opts.totalCents,
      total_cents: opts.totalCents,
      status: opts.status ?? "new",
      client_session_id: opts.session ?? null,
      scheduled_for: opts.scheduled ? new Date(Date.now() + DAY) : null,
      items: {
        create: opts.items.map((i) => ({
          product_id: i.productId,
          name_snapshot: i.name,
          unit_price_cents: Math.round(opts.totalCents / i.qty),
          quantity: i.qty,
          options_snapshot: [],
          line_total_cents: opts.totalCents,
        })),
      },
    },
  });
}

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, OTHER] } } });
  const license = {
    create: {
      plan_id: "negocio",
      status: "active" as const,
      ends_at: new Date(Date.now() + 30 * DAY),
    },
  };
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba analíticas",
      license,
      branches: {
        create: [
          { slug: "centro", name: "Centro", whatsapp_e164: "+50255550000" },
          { slug: "norte", name: "Norte", whatsapp_e164: "+50255550001" },
        ],
      },
    },
    select: { id: true, branches: { select: { id: true, slug: true } } },
  });
  businessId = biz.id;
  centro = biz.branches.find((b) => b.slug === "centro")!.id;
  norte = biz.branches.find((b) => b.slug === "norte")!.id;
  const other = await db().businesses.create({
    data: { slug: OTHER, name: "Otro", license },
    select: { id: true },
  });
  otherBusinessId = other.id;
  cafe = (
    await db().products.create({
      data: { business_id: businessId, name: "Café", price_cents: 1500 },
    })
  ).id;
  pan = (
    await db().products.create({
      data: { business_id: businessId, name: "Pan", price_cents: 1000 },
    })
  ).id;
  qrMesa = (
    await db().qr_codes.create({
      data: {
        business_id: businessId,
        branch_id: centro,
        label: "Mesa 4",
        short_code: "zzqrm038m4",
        table_label: "4",
      },
    })
  ).id;
});

afterAll(async () => {
  const ids = [businessId, otherBusinessId].filter(Boolean);
  await db().analytics_events.deleteMany({ where: { business_id: { in: ids } } });
  await db().audit_logs.deleteMany({ where: { business_id: { in: ids } } });
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, OTHER] } } });
  await db().$disconnect();
});

describe("analíticas", () => {
  it("guarda lotes del menú; descarta los de una sucursal de otro negocio", async () => {
    const s = (n: number) => `sesion-qrm038-${n}`;
    // 4 celulares en Centro: todos ven el menú, 3 abren un producto, 2 agregan, 2 abren su pedido.
    expect(
      await recordEvents(
        batch({
          businessId,
          branchId: centro,
          sessionId: s(1),
          events: [
            { event: "page_view", source: "qr" },
            { event: "product_view", productId: cafe },
            { event: "product_view", productId: cafe },
            { event: "add_to_cart", productId: cafe, quantity: 2 },
            { event: "checkout_start" },
          ],
        }),
      ),
    ).toBe(5);
    await recordEvents(
      batch({
        businessId,
        branchId: centro,
        sessionId: s(2),
        events: [
          { event: "page_view" },
          { event: "product_view", productId: pan },
          { event: "add_to_cart", productId: pan },
          { event: "checkout_start" },
        ],
      }),
    );
    await recordEvents(
      batch({
        businessId,
        branchId: centro,
        sessionId: s(3),
        events: [{ event: "page_view" }, { event: "product_view", productId: cafe }],
      }),
    );
    await recordEvents(
      batch({ businessId, branchId: centro, sessionId: s(4), events: [{ event: "page_view" }] }),
    );
    // Norte: 1 visita.
    await recordEvents(
      batch({ businessId, branchId: norte, sessionId: s(5), events: [{ event: "page_view" }] }),
    );
    // Lote con una sucursal ajena: no se guarda nada.
    expect(
      await recordEvents(
        batch({
          businessId: otherBusinessId,
          branchId: centro,
          sessionId: s(6),
          events: [{ event: "page_view" }],
        }),
      ),
    ).toBe(0);
    // 3 escaneos del QR de la mesa (los escribe /q/{código}).
    await db().analytics_events.createMany({
      data: [1, 2, 3].map((n) => ({
        business_id: businessId,
        branch_id: centro,
        event: "qr_scan",
        session_id: `scan-${n}`,
        qr_code_id: qrMesa,
      })),
    });

    const page = await db().analytics_events.findFirst({
      where: { business_id: businessId, session_id: s(1), event: "page_view" },
    });
    expect(page?.meta).toEqual({ source: "qr" });
    expect(await db().analytics_events.count({ where: { business_id: otherBusinessId } })).toBe(0);
  });

  it("el embudo y los pedidos cuadran con la base, por sucursal", async () => {
    // El celular 1 pide dos veces (una se cancela), el 2 una; el 4 vio Centro y pidió en Norte.
    await order(centro, {
      session: "sesion-qrm038-1",
      totalCents: 3000,
      items: [{ productId: cafe, name: "Café", qty: 2 }],
    });
    await order(centro, {
      session: "sesion-qrm038-2",
      status: "delivered",
      type: "delivery",
      totalCents: 5000,
      items: [{ productId: cafe, name: "Café", qty: 3 }],
    });
    await order(centro, {
      session: "sesion-qrm038-1",
      status: "cancelled",
      totalCents: 9900,
      items: [{ productId: pan, name: "Pan", qty: 9 }],
    });
    await order(norte, {
      session: "sesion-qrm038-4",
      scheduled: true,
      totalCents: 1000,
      items: [{ productId: pan, name: "Pan", qty: 1 }],
    });

    const r = range();
    const summary = await getSummary(businessId, [centro], r);
    const dbOrders = await db().orders.count({
      where: { business_id: businessId, branch_id: centro, created_at: { gte: r.from, lt: r.to } },
    });
    expect(summary).toMatchObject({
      visits: 4,
      visitors: 4,
      scans: 3,
      viewedProduct: 3,
      addedToCart: 2,
      startedCheckout: 2,
      orders: dbOrders,
      orderedVisitors: 2,
      cancelled: 1,
      validOrders: 2,
      revenueCents: 8000,
      delivery: 1,
      scheduled: 0,
    });
    expect(dbOrders).toBe(3);
    expect(funnel({ ...summary, orders: summary.orderedVisitors }).map((s) => s.value)).toEqual([
      4, 3, 2, 2, 2,
    ]);

    const both = await getSummary(businessId, [centro, norte], r);
    expect(both).toMatchObject({
      visits: 5,
      orders: 4,
      orderedVisitors: 3,
      scheduled: 1,
      revenueCents: 9000,
    });
    // En Norte nadie que vio ese menú pidió (el 4 vio el de Centro).
    expect(await getSummary(businessId, [norte], r)).toMatchObject({
      visits: 1,
      orders: 1,
      orderedVisitors: 0,
    });
    // Otro negocio o el periodo anterior: nada.
    expect((await getSummary(otherBusinessId, [centro], r)).visits).toBe(0);
    const before = await getSummary(businessId, [centro], {
      from: new Date(r.from.getTime() - 7 * DAY),
      to: new Date(r.to.getTime() - 7 * DAY),
    });
    expect(before.orders + before.visits).toBe(0);
  });

  it("detalle: productos más pedidos y vistos, escaneos por QR y pedidos por hora", async () => {
    const r = range();
    const b = await getBreakdown(businessId, [centro, norte], r);
    // Café 2 + 3 = 5; el pan del pedido cancelado no cuenta.
    expect(b.topOrdered[0]).toEqual({ name: "Café", quantity: 5, revenue: 8000 });
    expect(b.topOrdered.find((p) => p.name === "Pan")?.quantity).toBe(1);
    expect(b.topViewed).toEqual([
      { name: "Café", count: 3 },
      { name: "Pan", count: 1 },
    ]);
    expect(b.qrScans).toEqual([{ label: "Mesa 4", branch: "Centro", count: 3 }]);
    expect(b.byHour.reduce((sum, h) => sum + h.orders, 0)).toBe(3);

    const perBranch = await getBranchSummaries(
      businessId,
      [
        { id: centro, name: "Centro" },
        { id: norte, name: "Norte" },
      ],
      r,
    );
    expect(perBranch.map((p) => [p.name, p.summary.visits, p.summary.orders])).toEqual([
      ["Centro", 4, 3],
      ["Norte", 1, 1],
    ]);
  });

  it("exportar: una fila por día y sucursal, con los mismos números", async () => {
    const rows = await getDailyRows(businessId, [centro, norte], range());
    expect(
      rows.map((r) => [r.branch, r.visits, r.visitors, r.scans, r.orders, r.cancelled, r.revenue]),
    ).toEqual([
      ["Centro", 4, 4, 3, 3, 1, 8000],
      ["Norte", 1, 1, 0, 1, 0, 1000],
    ]);
    expect(rows[0]!.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
