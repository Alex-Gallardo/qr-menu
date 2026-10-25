/**
 * Datos del E2E (QRM-045) en la base compartida: un negocio `zz-test-e2e-*`
 * propio (nunca el demo), un admin de plataforma con 2FA y pagos por verificar.
 * Todo se borra al terminar; `teardown` también limpia restos de corridas
 * anteriores que se hayan cortado.
 *
 *   NODE_OPTIONS=--conditions=react-server tsx --env-file=.env.local \
 *     tests/e2e/fixtures/e2e-data.mts setup|teardown
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createOrderSchema } from "@/features/orders/schemas";
import { createOrder } from "@/features/orders/server";
import { authorizeDevice } from "@/features/staff/server";
import { db } from "@/lib/db";
import { guatemalaNow } from "@/lib/gt-time";
import { hashIp } from "@/lib/rate-limit";
import { serverClockOffset, totp } from "../support/totp";
import { E2E_EMAIL_DOMAIN, E2E_SLUG_PREFIX, RUN_FILE, type E2EData } from "../support/run-data";

const PROJECTS = ["iphone", "pixel"] as const;
const LOCAL_IPS = ["::1", "127.0.0.1", "::ffff:127.0.0.1"];
const DAY = 86_400_000;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const ZONA_1 = { lat: 14.6427, lng: -90.5133 };
const ZONA_10 = { lat: 14.6005, lng: -90.5089 };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Horario de la sucursal cerrada: abre en ~2 h (o mañana temprano si ya es noche). */
function closedWindow() {
  const now = guatemalaNow().minutes;
  if (now + 240 < 24 * 60) return { opens: hhmm(now + 120), closes: hhmm(now + 240) };
  return { opens: "06:00", closes: "08:00" };
}

async function setup() {
  await teardown(); // restos de una corrida cortada
  const run = Date.now().toString(36);
  const slug = `${E2E_SLUG_PREFIX}${run}`;
  const supabase = adminClient();

  // Admin de plataforma con 2FA (TOTP) ya inscrito, como la cuenta real.
  const adminEmail = `e2e-admin-${run}@${E2E_EMAIL_DOMAIN}`;
  const adminPassword = randomBytes(18).toString("base64url");
  const created = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: "Admin E2E" },
  });
  if (!created.data.user) throw new Error(`No se pudo crear el admin: ${created.error?.message}`);
  const adminId = created.data.user.id;
  await db().profiles.update({ where: { id: adminId }, data: { platform_role: "admin" } });
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const signedIn = await anon.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (signedIn.error) throw new Error(`El admin no pudo entrar: ${signedIn.error.message}`);
  const enrolled = await anon.auth.mfa.enroll({ factorType: "totp", friendlyName: "E2E" });
  if (enrolled.error) throw new Error(`No se pudo inscribir el 2FA: ${enrolled.error.message}`);
  const totpSecret = enrolled.data.totp.secret;
  const verified = await anon.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(
      totpSecret,
      Date.now() + (await serverClockOffset(process.env.NEXT_PUBLIC_SUPABASE_URL!)),
    ),
  });
  if (verified.error) throw new Error(`No se pudo verificar el 2FA: ${verified.error.message}`);
  await anon.auth.signOut();

  const closed = closedWindow();
  const business = await db().businesses.create({
    data: {
      slug,
      name: `Café E2E ${run}`,
      published: true,
      theme: { create: {} },
      license: {
        create: {
          plan_id: "negocio",
          status: "active",
          ends_at: new Date(Date.now() + 30 * DAY),
        },
      },
      branches: {
        create: [
          {
            slug: "zona-1",
            name: "Zona 1",
            address: "6a avenida 8-20, zona 1",
            city: "Ciudad de Guatemala",
            ...ZONA_1,
            whatsapp_e164: "+50255550101",
            accepts_delivery: true,
            delivery_fee_cents: 1500,
            delivery_radius_km: 6,
            sort: 0,
            hours: {
              create: ALL_WEEK.map((weekday) => ({ weekday, opens: "00:00", closes: "23:59" })),
            },
          },
          {
            slug: "zona-10",
            name: "Zona 10",
            address: "Avenida La Reforma 10-00, zona 10",
            city: "Ciudad de Guatemala",
            ...ZONA_10,
            whatsapp_e164: "+50255550110",
            accepts_delivery: true,
            delivery_fee_cents: 1500,
            delivery_radius_km: 6,
            sort: 1,
            hours: {
              create: ALL_WEEK.map((weekday) => ({ weekday, opens: "00:00", closes: "23:59" })),
            },
          },
          {
            slug: "nocturna",
            name: "Nocturna",
            city: "Antigua Guatemala",
            lat: 14.5586,
            lng: -90.7295,
            whatsapp_e164: "+50255550120",
            preorder_mode: "next_open",
            preorder_min_lead_min: 30,
            preorder_max_days: 2,
            sort: 2,
            hours: { create: ALL_WEEK.map((weekday) => ({ weekday, ...closed })) },
          },
        ],
      },
      products: {
        create: [
          { name: "Café de olla", price_cents: 1500, sort: 0 },
          { name: "Desayuno chapín", price_cents: 4500, sort: 1 },
        ],
      },
      time_slots: {
        create: {
          key: "lunch",
          name: "Todo el día",
          start_time: "00:00",
          end_time: "23:59",
          sort: 0,
        },
      },
      bank_accounts: {
        create: {
          bank_name: "Banco Industrial",
          account_type: "Monetaria",
          account_number: "000-000000-0",
          holder_name: "Café E2E, S.A.",
          instructions: "Envía tu comprobante por WhatsApp.",
        },
      },
    },
    select: {
      id: true,
      license: { select: { id: true } },
      branches: { select: { id: true, slug: true } },
      products: { select: { id: true, name: true } },
      time_slots: { select: { id: true } },
    },
  });
  const branch = (s: string) => business.branches.find((b) => b.slug === s)!.id;
  const productIds = business.products.map((p) => p.id);

  const menu = await db().menus.create({
    data: {
      business_id: business.id,
      name: "Menú E2E",
      is_default: true,
      sections: {
        create: {
          name: "Para empezar",
          items: { create: productIds.map((product_id, sort) => ({ product_id, sort })) },
        },
      },
    },
    select: { id: true },
  });
  await db().menu_schedules.create({
    data: { menu_id: menu.id, time_slot_id: business.time_slots[0]!.id, weekdays: ALL_WEEK },
  });

  const qr = await db().qr_codes.create({
    data: {
      business_id: business.id,
      branch_id: branch("zona-1"),
      label: "Mesa 4",
      table_label: "4",
      short_code: `e2e${run}`.slice(0, 16),
    },
    select: { short_code: true },
  });

  // Staff con PIN y una tablet autorizada por proyecto (S1), más un pedido a
  // domicilio por proyecto para atender (S2).
  const pin = "2468";
  await db().staff_members.create({
    data: {
      business_id: business.id,
      branch_id: branch("zona-1"),
      display_name: "Rosa E2E",
      pin_hash: await bcrypt.hash(pin, 10),
    },
  });
  const perProject = {} as E2EData["perProject"];
  for (const [i, project] of PROJECTS.entries()) {
    const { token } = await authorizeDevice({
      businessId: business.id,
      branchId: branch("zona-1"),
      name: `Tablet E2E ${project}`,
      approvedBy: adminId,
    });
    const order = await createOrder(
      createOrderSchema.parse({
        branchId: branch("zona-1"),
        clientSessionId: `e2e-${run}-${project}`,
        items: [{ productId: productIds[1]!, quantity: 2 }],
        orderType: "delivery",
        name: `Cliente S2 ${project}`,
        phone: "55551234",
        address: "7a avenida 12-30, zona 1",
        addressReference: "Portón negro",
        location: { coords: { lat: 14.6402, lng: -90.5141 }, accuracyM: 15, source: "gps" },
        payment: "cash",
      }),
      { ip: null },
    );
    const payment = await db().payments.create({
      data: {
        license_id: business.license!.id,
        amount_cents: 29900,
        method: "transfer",
        bank: "Banco Industrial",
        reference: `E2E-${run}-${i + 1}`,
        period_start: new Date(),
        period_end: new Date(Date.now() + 30 * DAY),
      },
      select: { reference: true },
    });
    perProject[project] = {
      deviceToken: token,
      deliveryOrderNumber: order.number,
      paymentReference: payment.reference,
    };
  }

  const data: E2EData = {
    run,
    slug,
    businessId: business.id,
    businessName: `Café E2E ${run}`,
    qrCode: qr.short_code,
    staffPin: pin,
    admin: { id: adminId, email: adminEmail, password: adminPassword, totpSecret },
    perProject,
  };
  mkdirSync(dirname(RUN_FILE), { recursive: true });
  writeFileSync(RUN_FILE, JSON.stringify(data, null, 2));
  console.log(`E2E listo: /${slug}`);
}

async function teardown() {
  const supabase = adminClient();
  const businesses = await db().businesses.findMany({
    where: { slug: { startsWith: E2E_SLUG_PREFIX } },
    select: { id: true, branches: { select: { devices: { select: { id: true } } } } },
  });
  const ids = businesses.map((b) => b.id);
  const deviceIds = businesses.flatMap((b) =>
    b.branches.flatMap((br) => br.devices.map((d) => d.id)),
  );
  if (ids.length) {
    // Fotos que subió el alta (D1): media/{negocio}/{carpeta}/…
    const media = supabase.storage.from("media");
    for (const id of ids) {
      const { data: folders } = await media.list(id);
      for (const folder of folders ?? []) {
        const { data: files } = await media.list(`${id}/${folder.name}`);
        const paths = (files ?? []).map((f) => `${id}/${folder.name}/${f.name}`);
        if (paths.length) await media.remove(paths);
      }
    }
    // Sin FK (no se borran solos con el negocio): auditoría y eventos de analíticas.
    await db().audit_logs.deleteMany({ where: { business_id: { in: ids } } });
    await db().analytics_events.deleteMany({ where: { business_id: { in: ids } } });
    await db().businesses.deleteMany({ where: { id: { in: ids } } });
  }

  // Usuarios del E2E (admin y altas de D1) y su auditoría.
  const users: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`No se pudieron listar usuarios: ${error.message}`);
    users.push(
      ...data.users
        .filter((u) => u.email?.startsWith("e2e-") && u.email.endsWith(`@${E2E_EMAIL_DOMAIN}`))
        .map((u) => u.id),
    );
    if (data.users.length < 200) break;
  }
  if (users.length) await db().audit_logs.deleteMany({ where: { actor_id: { in: users } } });
  for (const id of users) await supabase.auth.admin.deleteUser(id);
  if (users.length) await db().profiles.deleteMany({ where: { id: { in: users } } });

  // Límites de las corridas (PIN por dispositivo, pedidos por sesión e IP local, alta).
  await db().rate_limits.deleteMany({
    where: {
      OR: [
        { key: { in: deviceIds.map((id) => `pin:device:${id}`) } },
        { key: { startsWith: "order:session:e2e-" } },
        // El navegador de pruebas pide desde esta PC: nunca es tráfico real.
        { key: { in: LOCAL_IPS.map((ip) => `order:ip:${hashIp(ip)}`) } },
        ...users.map((id) => ({ key: `onboarding:${id}` })),
      ],
    },
  });
  rmSync(RUN_FILE, { force: true });
  if (ids.length || users.length)
    console.log(`E2E limpio: ${ids.length} negocios y ${users.length} usuarios borrados.`);
}

const command = process.argv[2];
try {
  if (command === "setup") await setup();
  else if (command === "teardown") await teardown();
  else throw new Error("Uso: e2e-data.mts setup|teardown");
} finally {
  await db().$disconnect();
}
