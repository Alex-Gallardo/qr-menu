import { createDecipheriv, createECDH, hkdfSync } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PushMessage } from "@/features/notifications/messages";
import {
  notifyNewOrder,
  saveSubscription,
  sendDueReminders,
} from "@/features/notifications/server";
import { db } from "@/lib/db";
import { fromB64url } from "@/lib/push/web-push";

/**
 * QRM-032 contra la base real: a quién le llega el aviso de un pedido, que
 * las suscripciones vencidas (410) se borran, el escalamiento cada 3 min
 * (máx. 3) y el aviso 30 min antes de los programados, todo con la hora de la
 * base. El servicio de push se simula (fetch): el contenido se descifra como
 * lo haría el navegador. Negocio zz-test-qrm032, se borra al terminar.
 */

const SLUG = "zz-test-qrm032";
// Llaves del navegador del ejemplo del RFC 8291 (Apéndice A).
const UA_PUBLIC =
  "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const UA_PRIVATE = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94";
const AUTH = "BTBZMqHH6r4Tts7J_aSIgg"; // gitleaks:allow (vector público del RFC 8291)
const endpoint = (name: string) => `https://fcm.googleapis.com/fcm/send/${SLUG}-${name}`;

function decrypt(body: Buffer): PushMessage {
  const salt = body.subarray(0, 16);
  const idLen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idLen);
  const data = body.subarray(21 + idLen);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(fromB64url(UA_PRIVATE));
  const shared = ecdh.computeSecret(asPublic);
  const uaPublic = fromB64url(UA_PUBLIC);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, fromB64url(AUTH), info, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: aes128gcm\0", 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: nonce\0", 12));
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(data.subarray(data.length - 16));
  const out = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return JSON.parse(out.subarray(0, -1).toString()) as PushMessage;
}

/** Lo que "recibió" cada endpoint en esta prueba. */
let inbox: Map<string, PushMessage[]>;
let headersSeen: Headers[];
const GONE = endpoint("owner-viejo");

let businessId: string;
let branchA: string;
let branchB: string;
let nextNumber = 1;

async function newOrder(
  branchId: string,
  data: { status?: "new" | "accepted" | "cancelled"; scheduledInMin?: number } = {},
) {
  const order = await db().orders.create({
    data: {
      business_id: businessId,
      branch_id: branchId,
      number: nextNumber++,
      customer_name: "María López",
      order_type: "delivery",
      payment_method: "cash",
      subtotal_cents: 12100,
      delivery_fee_cents: 1000,
      total_cents: 13100,
      status: data.status ?? "new",
    },
    select: { id: true, number: true },
  });
  if (data.scheduledInMin !== undefined)
    await db()
      .$executeRaw`UPDATE orders SET scheduled_for = now() + make_interval(mins => ${data.scheduledInMin}) WHERE id = ${order.id}::uuid`;
  return order;
}

/** Simula que el pedido se creó hace `minutes` (con la hora de la base). */
const age = (orderId: string, minutes: number) =>
  db()
    .$executeRaw`UPDATE orders SET created_at = now() - make_interval(mins => ${minutes}) WHERE id = ${orderId}::uuid`;

beforeAll(async () => {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
    throw new Error("Faltan las llaves VAPID: corre `pnpm push:keys --write`.");
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  const demo = await db().businesses.findUniqueOrThrow({
    where: { slug: "cafe-el-portal" },
    select: { members: { select: { user_id: true, role: true } } },
  });
  const ownerId = demo.members.find((m) => m.role === "owner")!.user_id;
  const managerId = demo.members.find((m) => m.role === "manager")!.user_id;
  const outsider = await db().profiles.findFirstOrThrow({
    where: { id: { notIn: [ownerId, managerId] } },
    select: { id: true },
  });

  const business = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-032",
      branches: {
        create: [
          { slug: "zona-10", name: "Zona 10", whatsapp_e164: "+50200000000" },
          { slug: "antigua", name: "Antigua", whatsapp_e164: "+50200000000", sort: 1 },
        ],
      },
    },
    select: { id: true, branches: { select: { id: true, slug: true } } },
  });
  businessId = business.id;
  branchA = business.branches.find((b) => b.slug === "zona-10")!.id;
  branchB = business.branches.find((b) => b.slug === "antigua")!.id;

  await db().business_members.create({
    data: { business_id: businessId, user_id: ownerId, role: "owner" },
  });
  await db().business_members.create({
    data: {
      business_id: businessId,
      user_id: managerId,
      role: "manager",
      all_branches: false,
      branches: { create: { branch_id: branchB } },
    },
  });
  const [rosa, ana] = await Promise.all([
    db().staff_members.create({
      data: { business_id: businessId, branch_id: branchA, display_name: "Rosa", pin_hash: "x" },
    }),
    db().staff_members.create({
      data: {
        business_id: businessId,
        branch_id: branchA,
        display_name: "Ana",
        pin_hash: "x",
        is_active: false,
      },
    }),
  ]);

  const sub = (name: string, who: { userId?: string; staffId?: string; branchId?: string }) =>
    saveSubscription({
      businessId,
      branchId: who.branchId ?? null,
      userId: who.userId ?? null,
      staffMemberId: who.staffId ?? null,
      endpoint: endpoint(name),
      p256dh: UA_PUBLIC,
      auth: AUTH,
      userAgent: "vitest",
    });
  await Promise.all([
    sub("owner-todas", { userId: ownerId }),
    sub("owner-viejo", { userId: ownerId }),
    sub("owner-antigua", { userId: ownerId, branchId: branchB }),
    sub("encargado-antigua", { userId: managerId }),
    sub("rosa-zona10", { staffId: rosa.id, branchId: branchA }),
    sub("ana-inactiva", { staffId: ana.id, branchId: branchA }),
    sub("ajeno", { userId: outsider.id }),
  ]);
});

beforeEach(() => {
  inbox = new Map();
  headersSeen = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    headersSeen.push(new Headers(init.headers));
    const list = inbox.get(url) ?? [];
    list.push(decrypt(Buffer.from(init.body as Uint8Array)));
    inbox.set(url, list);
    return new Response(null, { status: url === GONE ? 410 : 201 });
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db().businesses.deleteMany({ where: { slug: SLUG } });
});

describe("aviso de pedido nuevo (notifyNewOrder)", () => {
  it("llega al dueño, al staff activo de la sucursal y a nadie más; borra la suscripción vencida", async () => {
    const order = await newOrder(branchA);
    const report = await notifyNewOrder(order.id);

    expect([...inbox.keys()].sort()).toEqual(
      [endpoint("owner-todas"), GONE, endpoint("rosa-zona10")].sort(),
    );
    expect(report).toEqual({ sent: 2, removed: 1, failed: 0 });
    expect(await db().push_subscriptions.count({ where: { endpoint: GONE } })).toBe(0);
    const ok = await db().push_subscriptions.findUniqueOrThrow({
      where: { endpoint: endpoint("owner-todas") },
      select: { last_success_at: true },
    });
    expect(ok.last_success_at).not.toBeNull();

    const owner = inbox.get(endpoint("owner-todas"))![0]!;
    expect(owner).toEqual({
      title: `Nuevo pedido #${String(order.number).padStart(4, "0")} · Q131.00`,
      body: "María López · A domicilio · Zona 10",
      tag: `order-${order.id}`,
      url: `/panel/${businessId}/pedidos/${order.id}`,
    });
    expect(inbox.get(endpoint("rosa-zona10"))![0]!.url).toBe(`/staff/pedidos/${order.id}`);

    // VAPID y cifrado en los encabezados.
    const h = headersSeen[0]!;
    expect(h.get("content-encoding")).toBe("aes128gcm");
    expect(h.get("authorization")).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    expect(h.get("urgency")).toBe("high");
    expect(h.get("topic")).toBe(order.id.replace(/-/g, ""));
  });

  it("un pedido de Antigua llega al encargado de Antigua y al dueño que eligió Antigua", async () => {
    const order = await newOrder(branchB);
    await notifyNewOrder(order.id);
    expect([...inbox.keys()].sort()).toEqual(
      [endpoint("owner-todas"), endpoint("owner-antigua"), endpoint("encargado-antigua")].sort(),
    );
  });
});

describe("escalamiento (cron)", () => {
  it("si sigue «nuevo» repite a los 3, 6 y 9 minutos, y no más", async () => {
    const order = await newOrder(branchA);
    const sent = () =>
      db()
        .orders.findUniqueOrThrow({
          where: { id: order.id },
          select: { push_reminders_sent: true },
        })
        .then((o) => o.push_reminders_sent);

    await age(order.id, 2);
    expect((await sendDueReminders({ businessId })).reminders.orders).toBe(0);

    await age(order.id, 3);
    const first = await sendDueReminders({ businessId });
    expect(first.reminders).toMatchObject({ orders: 1, sent: 2 });
    expect(inbox.get(endpoint("owner-todas"))![0]!.title).toBe(
      `#${String(order.number).padStart(4, "0")} sigue esperando`,
    );
    expect(await sent()).toBe(1);

    // Otra corrida en el mismo minuto no repite.
    expect((await sendDueReminders({ businessId })).reminders.orders).toBe(0);

    await age(order.id, 6);
    await sendDueReminders({ businessId });
    await age(order.id, 9);
    await sendDueReminders({ businessId });
    expect(await sent()).toBe(3);
    await age(order.id, 12);
    expect((await sendDueReminders({ businessId })).reminders.orders).toBe(0);
  });

  it("no escala pedidos aceptados ni olvidados de hace más de 30 min", async () => {
    const accepted = await newOrder(branchA, { status: "accepted" });
    const old = await newOrder(branchA);
    await age(accepted.id, 4);
    await age(old.id, 45);
    expect((await sendDueReminders({ businessId })).reminders.orders).toBe(0);
  });
});

describe("programados: aviso 30 min antes", () => {
  it("avisa una vez cuando faltan ≤30 min, si se pidió con más anticipación", async () => {
    const order = await newOrder(branchA, { scheduledInMin: 25 });
    await age(order.id, 120);
    const result = await sendDueReminders({ businessId });
    expect(result.preorders).toMatchObject({ orders: 1, sent: 2 });
    expect(inbox.get(endpoint("rosa-zona10"))![0]!.title).toBe(
      `Programado #${String(order.number).padStart(4, "0")} en 30 min`,
    );
    expect((await sendDueReminders({ businessId })).preorders.orders).toBe(0);
  });

  it("no avisa si falta más de 30 min, si se creó dentro de la ventana o si se canceló", async () => {
    const far = await newOrder(branchA, { scheduledInMin: 50 });
    const recent = await newOrder(branchA, { scheduledInMin: 20 });
    const cancelled = await newOrder(branchA, { scheduledInMin: 20, status: "cancelled" });
    await age(far.id, 120);
    await age(recent.id, 5);
    await age(cancelled.id, 120);
    const result = await sendDueReminders({ businessId });
    expect(result.preorders.orders).toBe(0);
  });
});
