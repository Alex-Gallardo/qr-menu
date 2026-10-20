/**
 * Seed de qr-menu.
 *
 *   pnpm db:seed                    # dev (por defecto): base + demo + usuarios y PINs de prueba
 *   SEED_SCOPE=demo pnpm db:seed    # base + negocio demo (válido en producción: es la demo de ventas)
 *   SEED_SCOPE=base pnpm db:seed    # solo planes y platform_settings (producción)
 *
 * Idempotente: planes y ajustes se actualizan (los ajustes existentes no se pisan);
 * el negocio demo se borra y se vuelve a crear.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { PLAN_CATALOG } from "@/features/licensing/plan-catalog";
import { PLATFORM_SETTINGS_DEFAULTS } from "@/features/platform/defaults";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import {
  ANTIGUA_PRICE_OVERRIDES,
  DEMO_BRANCHES,
  DEMO_BUSINESS,
  DEMO_CATEGORIES,
  DEMO_CUSTOMERS,
  DEMO_DELIVERY_SPOTS,
  DEMO_MENUS,
  DEMO_PRODUCTS,
  DEMO_TIME_SLOTS,
  SOLD_OUT_IN_ANTIGUA,
  type DemoBranchKey,
} from "./seed/demo-data";
import { createRandom } from "./seed/random";
import { ensureAuthUser, seedPassword } from "./seed/users";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

type Scope = "base" | "demo" | "dev";
const scope = (process.env.SEED_SCOPE ?? "dev") as Scope;
const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

const DAY = 24 * 60 * 60 * 1000;
const GT_OFFSET_HOURS = 6; // America/Guatemala = UTC-6, sin horario de verano

/** Fecha UTC para un día relativo (0 = hoy) y una hora local de Guatemala. */
function gtDate(daysAgo: number, hour: number, minute = 0) {
  const nowGt = new Date(Date.now() - GT_OFFSET_HOURS * 60 * 60 * 1000);
  const d = Date.UTC(nowGt.getUTCFullYear(), nowGt.getUTCMonth(), nowGt.getUTCDate() - daysAgo);
  return new Date(d + (hour + GT_OFFSET_HOURS) * 60 * 60 * 1000 + minute * 60 * 1000);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

async function seedBase(db: PrismaClient) {
  for (const plan of PLAN_CATALOG) {
    const data = {
      name: plan.name,
      price_gtq: plan.price_gtq,
      limits: plan.limits,
      features: plan.features,
      sort: plan.sort,
    };
    await db.plans.upsert({
      where: { id: plan.id },
      create: { id: plan.id, ...data },
      update: data,
    });
  }
  for (const [key, value] of Object.entries(PLATFORM_SETTINGS_DEFAULTS)) {
    await db.platform_settings.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: {},
    });
  }
  console.log(
    `✓ ${PLAN_CATALOG.length} planes y ${Object.keys(PLATFORM_SETTINGS_DEFAULTS).length} ajustes`,
  );
}

async function seedDemo(db: PrismaClient) {
  await db.businesses.deleteMany({ where: { slug: DEMO_BUSINESS.slug } });

  const business = await db.businesses.create({
    data: { ...DEMO_BUSINESS, published: true },
  });
  const bid = business.id;
  const whatsapp = process.env.SEED_DEMO_WHATSAPP ?? "+50200000000";

  await db.themes.create({ data: { business_id: bid } });
  await db.licenses.create({
    data: {
      business_id: bid,
      plan_id: "negocio",
      status: "trial",
      ends_at: new Date(Date.now() + 14 * DAY),
      notes: "Negocio demo (herramienta de ventas)",
      events: { create: { type: "created", data: { plan: "negocio", trial_days: 14 } } },
    },
  });

  // Sucursales y horarios
  const branchIds = {} as Record<DemoBranchKey, string>;
  for (const b of DEMO_BRANCHES) {
    const { key, hours, ...data } = b;
    const branch = await db.branches.create({
      data: {
        ...data,
        business_id: bid,
        whatsapp_e164: whatsapp,
        hours: { create: hours.map(([weekday, opens, closes]) => ({ weekday, opens, closes })) },
      },
    });
    branchIds[key] = branch.id;
  }

  // Categorías y productos con opciones
  const categoryIds = new Map<string, string>();
  for (const [sort, name] of DEMO_CATEGORIES.entries()) {
    const c = await db.product_categories.create({ data: { business_id: bid, name, sort } });
    categoryIds.set(name, c.id);
  }
  const products = new Map<string, { id: string; price: number; name: string }>();
  for (const [sort, p] of DEMO_PRODUCTS.entries()) {
    const created = await db.products.create({
      data: {
        business_id: bid,
        category_id: categoryIds.get(p.category),
        name: p.name,
        description: p.description,
        price_cents: p.price,
        compare_at_cents: p.compareAt,
        image_url: p.image,
        tags: p.tags ?? [],
        prep_minutes: p.prep,
        sort,
        option_groups: {
          create: (p.groups ?? []).map((g, gi) => ({
            name: g.name,
            min_select: g.min,
            max_select: g.max,
            sort: gi,
            options: {
              create: g.options.map(([name, delta], oi) => ({
                name,
                price_delta_cents: delta,
                sort: oi,
              })),
            },
          })),
        },
      },
    });
    products.set(p.key, { id: created.id, price: p.price, name: p.name });
  }

  // Disponibilidad y precio por sucursal (Antigua)
  const prod = (key: string) => {
    const p = products.get(key);
    if (!p) throw new Error(`Producto demo desconocido: ${key}`);
    return p;
  };
  await db.branch_products.create({
    data: {
      branch_id: branchIds.antigua,
      product_id: prod(SOLD_OUT_IN_ANTIGUA).id,
      is_available: false,
    },
  });
  for (const [key, price] of Object.entries(ANTIGUA_PRICE_OVERRIDES)) {
    await db.branch_products.create({
      data: { branch_id: branchIds.antigua, product_id: prod(key).id, price_override_cents: price },
    });
  }

  // Franjas, menús y programación
  const slotIds = {} as Record<(typeof DEMO_TIME_SLOTS)[number]["key"], string>;
  for (const [sort, s] of DEMO_TIME_SLOTS.entries()) {
    const slot = await db.time_slots.create({
      data: {
        business_id: bid,
        key: s.key,
        name: s.name,
        start_time: s.start,
        end_time: s.end,
        sort,
      },
    });
    slotIds[s.key] = slot.id;
  }
  const menuIds = {} as Record<(typeof DEMO_MENUS)[number]["key"], string>;
  for (const m of DEMO_MENUS) {
    const menu = await db.menus.create({
      data: {
        business_id: bid,
        name: m.name,
        description: m.description,
        is_default: m.isDefault,
        sections: {
          create: m.sections.map((s, si) => ({
            name: s.name,
            sort: si,
            items: {
              create: s.items.map((key, ii) => ({
                product_id: prod(key).id,
                price_override_cents: m.priceOverrides?.[key],
                is_featured: ii === 0 && si === 0,
                sort: ii,
              })),
            },
          })),
        },
      },
    });
    menuIds[m.key] = menu.id;
  }
  const allWeek = [0, 1, 2, 3, 4, 5, 6];
  await db.menu_schedules.createMany({
    data: [
      { menu_id: menuIds.desayunos, time_slot_id: slotIds.breakfast, weekdays: allWeek },
      { menu_id: menuIds.almuerzo, time_slot_id: slotIds.lunch, weekdays: [1, 2, 3, 4, 5] },
      { menu_id: menuIds.carta, time_slot_id: slotIds.lunch, weekdays: [0, 6] },
      { menu_id: menuIds.carta, time_slot_id: slotIds.dinner, weekdays: allWeek },
      // Regla de sucursal: en Antigua el almuerzo de diario también es la carta (gana por prioridad).
      {
        menu_id: menuIds.carta,
        time_slot_id: slotIds.lunch,
        branch_id: branchIds.antigua,
        weekdays: [1, 2, 3, 4, 5],
        priority: 10,
      },
    ],
  });
  // Fecha especial: Zona 1 cerrada dentro de una semana (feriado de ejemplo).
  await db.menu_overrides.create({
    data: {
      business_id: bid,
      branch_id: branchIds.zona1,
      date: gtDate(-7, 0),
      note: "Cerrado por feriado",
    },
  });

  // Cuentas bancarias (ficticias)
  await db.bank_accounts.createMany({
    data: [
      {
        business_id: bid,
        bank_name: "Banco Industrial",
        account_type: "Monetaria",
        account_number: "000-000000-0",
        holder_name: "Café El Portal, S.A.",
        instructions: "Envía tu comprobante por WhatsApp con tu número de pedido.",
        sort: 0,
      },
      {
        business_id: bid,
        branch_id: branchIds.antigua,
        bank_name: "Banrural",
        account_type: "Ahorro",
        account_number: "0000000000",
        holder_name: "Café El Portal Antigua",
        sort: 1,
      },
    ],
  });

  // QR por sucursal y mesa
  const qrIds: Record<DemoBranchKey, string[]> = { zona1: [], antigua: [] };
  const qrDefs: [DemoBranchKey, string, string | null][] = [
    ["zona1", "General", null],
    ["zona1", "Mesa 1", "1"],
    ["zona1", "Mesa 2", "2"],
    ["zona1", "Mesa 3", "3"],
    ["zona1", "Mesa 4", "4"],
    ["antigua", "General", null],
    ["antigua", "Mesa 1", "1"],
    ["antigua", "Mesa 2", "2"],
  ];
  for (const [i, [key, label, table]] of qrDefs.entries()) {
    const qr = await db.qr_codes.create({
      data: {
        business_id: bid,
        branch_id: branchIds[key],
        label,
        table_label: table,
        short_code: `demo${String(i + 1).padStart(2, "0")}`,
        scans: 20 + i * 7,
      },
    });
    qrIds[key].push(qr.id);
  }

  const orders = await seedDemoOrders(db, bid, branchIds, products, qrIds);
  console.log(
    `✓ ${DEMO_BUSINESS.name}: ${DEMO_BRANCHES.length} sucursales, ${products.size} productos, ` +
      `${DEMO_MENUS.length} menús, ${DEMO_TIME_SLOTS.length} franjas, ${orders} pedidos`,
  );
  return { businessId: bid, branchIds };
}

async function seedDemoOrders(
  db: PrismaClient,
  bid: string,
  branchIds: Record<DemoBranchKey, string>,
  products: Map<string, { id: string; price: number; name: string }>,
  qrIds: Record<DemoBranchKey, string[]>,
) {
  const rnd = createRandom(20261020);
  const productKeys = DEMO_PRODUCTS.filter((p) => !p.groups).map((p) => p.key);
  const counters: Record<DemoBranchKey, number> = { zona1: 0, antigua: 0 };
  const branchByKey = Object.fromEntries(DEMO_BRANCHES.map((b) => [b.key, b]));
  const TOTAL = 30;
  const DELIVERY = new Set([2, 7, 13, 19, 26]); // 5 pedidos a domicilio con coordenadas

  for (let i = 0; i < TOTAL; i++) {
    const branchKey: DemoBranchKey = i % 3 === 2 ? "antigua" : "zona1";
    const branch = branchByKey[branchKey]!;
    const daysAgo = i < 4 ? 0 : rnd.int(1, 13);
    // Los de hoy son recientes (bandeja activa); el resto, en horario de atención.
    const createdAt =
      daysAgo === 0
        ? new Date(Date.now() - rnd.int(5, 90) * 60 * 1000)
        : gtDate(daysAgo, rnd.int(8, 20), rnd.int(0, 59));
    const number = ++counters[branchKey];

    const isDelivery = DELIVERY.has(i);
    const orderType = isDelivery ? "delivery" : rnd.pick(["dine_in", "takeout"] as const);
    const spot = isDelivery ? rnd.pick(DEMO_DELIVERY_SPOTS[branchKey]) : null;

    const lines = Array.from({ length: rnd.int(1, 3) }, () => {
      const p = products.get(rnd.pick(productKeys))!;
      const quantity = rnd.int(1, 2);
      return {
        product_id: p.id,
        name_snapshot: p.name,
        unit_price_cents: p.price,
        quantity,
        options_snapshot: [],
        line_total_cents: p.price * quantity,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.line_total_cents, 0);
    const deliveryFee = isDelivery ? branch.delivery_fee_cents : 0;

    // Hoy: pedidos activos; días anteriores: entregados (uno cancelado).
    const status =
      daysAgo === 0
        ? (["new", "accepted", "preparing", "ready"] as const)[i]!
        : i === 11
          ? "cancelled"
          : "delivered";
    const flow = {
      new: ["new"],
      accepted: ["new", "accepted"],
      preparing: ["new", "accepted", "preparing"],
      ready: ["new", "accepted", "preparing", "ready"],
      delivered: ["new", "accepted", "preparing", "ready", "delivered"],
      cancelled: ["new", "cancelled"],
    }[status] as (typeof status)[];

    await db.orders.create({
      data: {
        business_id: bid,
        branch_id: branchIds[branchKey],
        number,
        customer_name: rnd.pick(DEMO_CUSTOMERS),
        customer_phone: null,
        customer_email: null,
        order_type: orderType,
        table_label: orderType === "dine_in" ? String(rnd.int(1, 4)) : null,
        qr_code_id: orderType === "dine_in" ? rnd.pick(qrIds[branchKey]) : null,
        address: spot?.address,
        address_reference: spot?.reference,
        delivery_lat: spot?.lat,
        delivery_lng: spot?.lng,
        delivery_accuracy_m: spot ? rnd.int(8, 40) : null,
        location_source: spot ? "gps" : null,
        distance_km: spot ? haversineKm(branch, spot) : null,
        payment_method: rnd.pick(["cash", "card_on_site", "transfer"] as const),
        subtotal_cents: subtotal,
        delivery_fee_cents: deliveryFee,
        total_cents: subtotal + deliveryFee,
        status,
        whatsapp_opened_at: rnd.chance(0.9) ? createdAt : null,
        created_at: createdAt,
        items: { create: lines },
        events: {
          create: flow.map((s, k) => ({
            status: s,
            created_at: new Date(createdAt.getTime() + k * 6 * 60 * 1000),
          })),
        },
        ...(status === "delivered" && rnd.chance(0.3)
          ? {
              review: {
                create: {
                  business_id: bid,
                  branch_id: branchIds[branchKey],
                  rating: rnd.pick([4, 5, 5, 5, 3]),
                  comment: rnd.pick(["¡Delicioso!", "Rápido y rico", null, "Muy buen café"]),
                  clicked_google: rnd.chance(0.4),
                  created_at: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
                },
              },
            }
          : {}),
      },
    });
  }

  // El consecutivo continúa después de los pedidos de ejemplo.
  for (const key of Object.keys(counters) as DemoBranchKey[]) {
    await db.branches.update({
      where: { id: branchIds[key] },
      data: { next_order_number: counters[key] + 1 },
    });
  }
  return TOTAL;
}

/** Solo desarrollo: usuarios de prueba, membresías y staff con PIN. */
async function seedDev(
  db: PrismaClient,
  demo: { businessId: string; branchIds: Record<DemoBranchKey, string> },
) {
  const password = seedPassword();
  const admin = await ensureAuthUser("admin", password);
  const owner = await ensureAuthUser("owner", password);
  const manager = await ensureAuthUser("manager", password);

  await db.profiles.update({ where: { id: admin.id }, data: { platform_role: "admin" } });
  await db.business_members.create({
    data: { business_id: demo.businessId, user_id: owner.id, role: "owner" },
  });
  await db.business_members.create({
    data: {
      business_id: demo.businessId,
      user_id: manager.id,
      role: "manager",
      all_branches: false,
      branches: { create: { branch_id: demo.branchIds.antigua } },
    },
  });

  // PINs de prueba (bcrypt). Nunca se crean en producción.
  const staff: [DemoBranchKey, string, string][] = [
    ["zona1", "Rosa - caja", process.env.SEED_STAFF_PIN_ZONA1 ?? "1234"],
    ["antigua", "Luis - cocina", process.env.SEED_STAFF_PIN_ANTIGUA ?? "5678"],
  ];
  for (const [key, display_name, pin] of staff) {
    await db.staff_members.create({
      data: {
        business_id: demo.businessId,
        branch_id: demo.branchIds[key],
        display_name,
        pin_hash: await bcrypt.hash(pin, 10),
      },
    });
  }
  console.log(
    `✓ Usuarios de prueba: ${admin.email} (admin), ${owner.email} (dueño), ` +
      `${manager.email} (encargado de Antigua) · 2 staff con PIN`,
  );
}

async function main() {
  if (!["base", "demo", "dev"].includes(scope)) throw new Error(`SEED_SCOPE inválido: ${scope}`);
  if (isProduction && scope === "dev") {
    throw new Error("El seed 'dev' crea usuarios y PINs de prueba: no se ejecuta en producción.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (ver .env.example).");

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    console.log(`Seed (${scope})…`);
    await seedBase(db);
    if (scope === "base") return;
    const demo = await seedDemo(db);
    if (scope === "dev") await seedDev(db, demo);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
