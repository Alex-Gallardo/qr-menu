import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAssistedBusiness,
  closeStaffSessions,
  ownerAccessLink,
} from "@/features/admin/businesses";
import {
  changePlan,
  extendLicense,
  registerManualPayment,
  rejectPayment,
  setLicenseStatus,
  updateOverrides,
  verifyPayment,
} from "@/features/admin/licenses";
import { getBusinessDetail, getDashboard, listAudit, listPayments } from "@/features/admin/queries";
import {
  deleteAnnouncement,
  getPlatformSettings,
  saveAnnouncement,
  savePlatformSettings,
} from "@/features/admin/settings";
import { getEntitlements } from "@/features/licensing/server";
import { runLicenseLifecycle } from "@/features/licensing/lifecycle-server";
import { acceptInvitation, getInvitation } from "@/features/team/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/** QRM-042: toda acción en auditoría; vencida pasa a gracia y luego a Gratis. */

const DAY = 24 * 60 * 60 * 1000;
const SLUG = "zz-test-qrm042-admin";
const ASSISTED = "zz-test-qrm042-fundador";
const adminId = randomUUID();
const ownerId = randomUUID();
let businessId: string;
let licenseId: string;
let settingsBackup: { key: string; value: unknown }[] = [];
const SETTING_KEYS = [
  "maintenance_mode",
  "trial_days",
  "founder_trial_days",
  "grace_days",
  "reserved_slugs",
  "payment_accounts",
];

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e as AppError,
  );
const ctx = { actorId: adminId };

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, ASSISTED] } } });
  await db().profiles.createMany({
    data: [
      { id: adminId, full_name: "Admin QRM-042", platform_role: "admin" },
      { id: ownerId, full_name: "Fundador QRM-042" },
    ],
  });
  settingsBackup = (
    await db().platform_settings.findMany({ where: { key: { in: SETTING_KEYS } } })
  ).map((s) => ({ key: s.key, value: s.value }));
  // Pro activa que vence en 1 hora; 2 sucursales, 30 productos y 2 QR (más que Gratis).
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba admin",
      license: {
        create: {
          plan_id: "pro",
          status: "active",
          ends_at: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
      branches: {
        create: [
          { slug: "centro", name: "Centro", whatsapp_e164: "+50255550000", sort: 0 },
          { slug: "norte", name: "Norte", whatsapp_e164: "+50255550001", sort: 1 },
        ],
      },
      products: {
        create: Array.from({ length: 30 }, (_, i) => ({
          name: `Producto ${i}`,
          price_cents: 1000,
          sort: i,
        })),
      },
    },
    select: {
      id: true,
      license: { select: { id: true } },
      branches: { select: { id: true, slug: true } },
    },
  });
  businessId = biz.id;
  licenseId = biz.license!.id;
  const centro = biz.branches.find((b) => b.slug === "centro")!.id;
  await db().qr_codes.createMany({
    data: [
      {
        business_id: businessId,
        branch_id: centro,
        label: "Sucursal",
        short_code: `zq42a${Date.now() % 100000}`,
      },
      {
        business_id: businessId,
        branch_id: centro,
        label: "Mesa 1",
        short_code: `zq42b${Date.now() % 100000}`,
        table_label: "1",
      },
    ],
  });
});

afterAll(async () => {
  // Configuración global exactamente como estaba.
  await db().platform_settings.deleteMany({
    where: { key: { in: SETTING_KEYS.filter((k) => !settingsBackup.some((s) => s.key === k)) } },
  });
  for (const s of settingsBackup)
    await db().platform_settings.update({
      where: { key: s.key },
      data: { value: s.value as never },
    });
  const ids = (
    await db().businesses.findMany({
      where: { slug: { in: [SLUG, ASSISTED] } },
      select: { id: true },
    })
  ).map((b) => b.id);
  await db().audit_logs.deleteMany({
    where: { OR: [{ business_id: { in: ids } }, { actor_id: adminId }] },
  });
  await db().businesses.deleteMany({ where: { slug: { in: [SLUG, ASSISTED] } } });
  await db().profiles.deleteMany({ where: { id: { in: [adminId, ownerId] } } });
  await db().$disconnect();
});

describe("ciclo de vida (cron diario)", () => {
  it("vigente: nada; vencida: pasa a gracia (con evento y auditoría)", async () => {
    expect(await runLicenseLifecycle(new Date(), [businessId])).toMatchObject({
      grace: 0,
      downgraded: 0,
    });
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
    expect(await runLicenseLifecycle(later, [businessId])).toMatchObject({ grace: 1 });
    const l = await db().licenses.findUniqueOrThrow({ where: { id: licenseId } });
    expect(l.status).toBe("grace");
    // Idempotente.
    expect(await runLicenseLifecycle(later, [businessId])).toMatchObject({
      grace: 0,
      downgraded: 0,
    });
  });

  it("al terminar la gracia baja a Gratis y oculta lo que excede (sin borrar)", async () => {
    const afterGrace = new Date(Date.now() + 8 * DAY);
    expect(await runLicenseLifecycle(afterGrace, [businessId])).toMatchObject({ downgraded: 1 });
    const l = await db().licenses.findUniqueOrThrow({ where: { id: licenseId } });
    expect(l).toMatchObject({ plan_id: "gratis", status: "active" });
    expect(
      await db().branches.count({ where: { business_id: businessId, hidden_by_license: true } }),
    ).toBe(1);
    expect(
      await db().products.count({ where: { business_id: businessId, hidden_by_license: true } }),
    ).toBe(5);
    expect(await db().products.count({ where: { business_id: businessId } })).toBe(30);
    expect(
      await db().qr_codes.count({ where: { business_id: businessId, hidden_by_license: true } }),
    ).toBe(1);
    const events = (await db().license_events.findMany({ where: { license_id: licenseId } })).map(
      (e) => e.type,
    );
    expect(events).toEqual(expect.arrayContaining(["grace", "downgraded"]));
    expect((await getEntitlements(businessId)).planId).toBe("gratis");
  });
});

describe("pagos", () => {
  let paymentId: string;

  it("verificar: vuelve a Pro activa, extiende y muestra lo oculto", async () => {
    const p = await db().payments.create({
      data: {
        license_id: licenseId,
        amount_cents: 14_900,
        method: "transfer",
        reference: "QRM042-1",
        period_start: new Date(),
        period_end: new Date(),
      },
    });
    await db().license_events.create({
      data: {
        license_id: licenseId,
        type: "payment_submitted",
        data: { payment_id: p.id, plan: "pro", period: "monthly" },
      },
    });
    paymentId = p.id;
    expect((await listPayments("pending")).some((x) => x.id === p.id)).toBe(true);
    const { endsAt, planId } = await verifyPayment(p.id, ctx);
    expect(planId).toBe("pro");
    expect(endsAt.getTime()).toBeGreaterThan(Date.now() + 27 * DAY);
    const l = await db().licenses.findUniqueOrThrow({ where: { id: licenseId } });
    expect(l).toMatchObject({ plan_id: "pro", status: "active" });
    expect(
      await db().products.count({ where: { business_id: businessId, hidden_by_license: true } }),
    ).toBe(0);
    expect((await failure(verifyPayment(p.id, ctx)))?.code).toBe("conflict");
  });

  it("rechazar con motivo (lo ve el negocio); pago manual extiende", async () => {
    const p = await db().payments.create({
      data: {
        license_id: licenseId,
        amount_cents: 1,
        method: "transfer",
        reference: "QRM042-2",
        period_start: new Date(),
        period_end: new Date(),
      },
    });
    await rejectPayment(p.id, "El monto no coincide.", ctx);
    expect((await db().payments.findUniqueOrThrow({ where: { id: p.id } })).rejection_reason).toBe(
      "El monto no coincide.",
    );
    const before = (await db().licenses.findUniqueOrThrow({ where: { id: licenseId } })).ends_at;
    const { endsAt } = await registerManualPayment(
      {
        businessId,
        planId: "negocio",
        period: "annual",
        amountCents: 299_000,
        reference: "Efectivo",
      },
      ctx,
    );
    expect(endsAt.getUTCFullYear()).toBe(before.getUTCFullYear() + 1);
    expect((await db().licenses.findUniqueOrThrow({ where: { id: licenseId } })).plan_id).toBe(
      "negocio",
    );
    expect(paymentId).toBeTruthy();
  });
});

describe("licencia a la medida y estado", () => {
  it("límites y funciones a la medida se aplican a los permisos", async () => {
    await updateOverrides(
      businessId,
      { limits: { branches: 5 }, features: { add: [], remove: ["remove_branding"] } },
      ctx,
    );
    const e = await getEntitlements(businessId);
    expect(e.limits.branches).toBe(5);
    expect(e.features).not.toContain("remove_branding");
    await updateOverrides(businessId, { limits: null, features: null }, ctx);
  });

  it("extender, suspender (solo lectura) y reactivar; cambiar a Gratis oculta", async () => {
    await extendLicense(businessId, 10, ctx);
    await setLicenseStatus(businessId, "suspended", "Prueba de soporte", ctx);
    expect((await getEntitlements(businessId)).readOnly).toBe(true);
    await setLicenseStatus(businessId, "active", "Listo", ctx);
    expect((await getEntitlements(businessId)).readOnly).toBe(false);
    await changePlan(businessId, "gratis", ctx);
    expect(
      await db().branches.count({ where: { business_id: businessId, hidden_by_license: true } }),
    ).toBe(1);
    await changePlan(businessId, "pro", ctx);
    expect(
      await db().branches.count({ where: { business_id: businessId, hidden_by_license: true } }),
    ).toBe(0);
  });

  it("toda acción queda en la auditoría (criterio)", async () => {
    const { rows } = await listAudit({ businessId, page: 0 });
    const actions = rows.map((r) => r.action);
    for (const a of [
      "license.grace",
      "license.downgrade",
      "license.payment_verified",
      "license.payment_rejected",
      "license.overrides_changed",
      "license.extended",
      "license.suspended",
      "license.reactivated",
      "license.plan_changed",
    ])
      expect(actions).toContain(a);
    expect(rows.find((r) => r.action === "license.extended")?.actor).toBe("Admin QRM-042");
    expect(rows.find((r) => r.action === "license.grace")?.actor).toBe("Sistema");
  });
});

describe("alta asistida y soporte", () => {
  it("crea el negocio con prueba de 60 días y precio especial; el dueño acepta su invitación", async () => {
    const res = await createAssistedBusiness(
      {
        name: "Fundador",
        slug: ASSISTED,
        branchName: "Zona 10",
        whatsapp: "5555-0000",
        ownerEmail: "fundador-qrm042@qrmenu.test",
        planId: "pro",
        trialDays: 60,
        priceOverrideGtq: 99,
        notes: "Fundador",
      },
      ctx,
    );
    const token = res.invitePath.split("/").pop()!;
    const inv = await getInvitation(token);
    expect(inv).toMatchObject({ role: "owner", email: "fundador-qrm042@qrmenu.test" });
    const detail = await getBusinessDetail(res.businessId);
    expect(detail?.business.license).toMatchObject({
      plan_id: "pro",
      status: "trial",
      price_override_gtq: 99,
    });
    await acceptInvitation(token, { id: ownerId, email: "fundador-qrm042@qrmenu.test" });
    // Una prueba suspendida vuelve a ser prueba al reactivarse.
    await setLicenseStatus(res.businessId, "suspended", "Pausa de prueba", ctx);
    await setLicenseStatus(res.businessId, "active", "Listo", ctx);
    expect(
      (await db().licenses.findUniqueOrThrow({ where: { business_id: res.businessId } })).status,
    ).toBe("trial");
    const member = await db().business_members.findFirstOrThrow({
      where: { business_id: res.businessId },
    });
    expect(member).toMatchObject({ user_id: ownerId, role: "owner", all_branches: true });
  });

  it("enlace de acceso sin dueño con cuenta: aviso claro; cerrar sesiones de staff", async () => {
    expect((await failure(ownerAccessLink(businessId, "http://localhost", ctx)))?.code).toBe(
      "not_found",
    );
    expect(await closeStaffSessions(businessId, ctx)).toBe(0);
  });

  it("tablero: cuenta estados, MRR y pagos por verificar", async () => {
    const d = await getDashboard();
    expect(d.total).toBeGreaterThan(0);
    expect(typeof d.mrrCents).toBe("number");
    expect(d.pendingPayments).toBeGreaterThanOrEqual(0);
  });
});

describe("configuración y anuncios", () => {
  it("guarda la configuración (y la prueba la deja como estaba)", async () => {
    const before = await getPlatformSettings();
    await savePlatformSettings(
      {
        maintenance: { enabled: false, message: "" },
        trialDays: before.trialDays,
        founderTrialDays: before.founderTrialDays,
        graceDays: before.graceDays,
        reservedSlugs: ["zz-qrm042"],
        paymentAccounts: [
          { bank: "Banco Prueba", type: "Monetaria", number: "000-1", holder: "QR" },
        ],
      },
      ctx,
    );
    const after = await getPlatformSettings();
    expect(after.reservedSlugs).toEqual(["zz-qrm042"]);
    expect(after.paymentAccounts).toHaveLength(1);
  });

  it("anuncios: crear y borrar (auditados)", async () => {
    const a = await saveAnnouncement(
      {
        title: "Prueba",
        body: "Anuncio QRM-042",
        audience: `business:${businessId}`,
        startsAt: new Date(),
        endsAt: null,
        isActive: false,
      },
      ctx,
    );
    await deleteAnnouncement(a.id, ctx);
    const { rows } = await listAudit({ action: "announcement", page: 0 });
    expect(
      rows
        .filter((r) => r.entity_id === a.id)
        .map((r) => r.action)
        .sort(),
    ).toEqual(["announcement.create", "announcement.delete"]);
  });
});
