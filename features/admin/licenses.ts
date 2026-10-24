import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { nextPeriod, type BillingPeriod } from "@/features/billing/billing";
import { FREE_PLAN } from "@/features/licensing/lifecycle";
import { hideOverLimits, restoreHidden } from "@/features/licensing/lifecycle-server";
import { parseLimits } from "@/features/licensing/entitlements";
import { audit } from "@/lib/audit";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { emailEnabled, sendEmail } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { formatQ } from "@/lib/money";

type Ctx = { actorId: string };
const DAY = 24 * 60 * 60 * 1000;

async function licenseOf(businessId: string) {
  const license = await db().licenses.findUnique({
    where: { business_id: businessId },
    select: { id: true, plan_id: true, status: true, ends_at: true, grace_days: true },
  });
  if (!license) throw new AppError("not_found", "Ese negocio no tiene licencia.");
  return license;
}

/** Cambio en la licencia → license_events + auditoría de plataforma (todo queda registrado). */
async function record(
  businessId: string,
  licenseId: string,
  type: string,
  data: Prisma.InputJsonValue,
  { actorId }: Ctx,
) {
  await db().license_events.create({
    data: { license_id: licenseId, type, data, actor_id: actorId },
  });
  await audit({
    actorId,
    actorKind: "platform",
    businessId,
    action: `license.${type}`,
    entity: "licenses",
    entityId: licenseId,
    diff: data,
  });
}

async function freeLimits() {
  const plan = await db().plans.findUnique({ where: { id: FREE_PLAN }, select: { limits: true } });
  const l = parseLimits(plan?.limits);
  return { branches: l.branches, products: l.products, menus: l.menus, qr: l.qr, staff: l.staff };
}

/** Cambiar plan: a Gratis oculta lo que excede; a uno pagado devuelve lo oculto. */
export async function changePlan(businessId: string, planId: string, ctx: Ctx) {
  const license = await licenseOf(businessId);
  const plan = await db().plans.findUnique({ where: { id: planId }, select: { id: true } });
  if (!plan) throw new AppError("validation", "Ese plan no existe.");
  if (license.plan_id === planId) return;
  const limits = planId === FREE_PLAN ? await freeLimits() : null;
  await db().$transaction(async (tx) => {
    await tx.licenses.update({
      where: { id: license.id },
      data: { plan_id: planId, updated_by: ctx.actorId },
    });
    if (limits) await hideOverLimits(tx, businessId, limits);
    else await restoreHidden(tx, businessId);
  });
  await record(businessId, license.id, "plan_changed", { from: license.plan_id, to: planId }, ctx);
}

/** Extender la vigencia N días (desde el fin actual o desde hoy si ya venció). */
export async function extendLicense(businessId: string, days: number, ctx: Ctx) {
  const license = await licenseOf(businessId);
  const now = Date.now();
  const base = Math.max(now, license.ends_at.getTime());
  const endsAt = new Date(base + days * DAY);
  await db().$transaction(async (tx) => {
    await tx.licenses.update({
      where: { id: license.id },
      // Si estaba en gracia vuelve a activa; la prueba sigue siendo prueba.
      data: {
        ends_at: endsAt,
        status: license.status === "grace" ? "active" : license.status,
        updated_by: ctx.actorId,
      },
    });
    if (license.plan_id !== FREE_PLAN) await restoreHidden(tx, businessId);
  });
  await record(businessId, license.id, "extended", { days, ends_at: endsAt.toISOString() }, ctx);
}

/** Precio especial (null = el de lista), días de gracia y notas internas. */
export async function updateLicenseTerms(
  businessId: string,
  terms: { priceOverrideGtq: number | null; graceDays: number; notes: string | null },
  ctx: Ctx,
) {
  const license = await licenseOf(businessId);
  await db().licenses.update({
    where: { id: license.id },
    data: {
      price_override_gtq: terms.priceOverrideGtq,
      grace_days: terms.graceDays,
      notes: terms.notes,
      updated_by: ctx.actorId,
    },
  });
  await record(
    businessId,
    license.id,
    "terms_changed",
    { price_override_gtq: terms.priceOverrideGtq, grace_days: terms.graceDays },
    ctx,
  );
}

/** Límites y funciones a la medida (JSON ya validado). */
export async function updateOverrides(
  businessId: string,
  overrides: { limits: Prisma.InputJsonValue | null; features: Prisma.InputJsonValue | null },
  ctx: Ctx,
) {
  const license = await licenseOf(businessId);
  await db().licenses.update({
    where: { id: license.id },
    data: {
      limit_overrides: overrides.limits ?? Prisma.DbNull,
      feature_overrides: overrides.features ?? Prisma.DbNull,
      updated_by: ctx.actorId,
    },
  });
  await record(
    businessId,
    license.id,
    "overrides_changed",
    { limits: overrides.limits, features: overrides.features },
    ctx,
  );
}

/** Suspender (solo lectura, menú fuera de línea), reactivar o cancelar. */
export async function setLicenseStatus(
  businessId: string,
  status: "suspended" | "active" | "cancelled",
  reason: string,
  ctx: Ctx,
) {
  const license = await licenseOf(businessId);
  if (license.status === status) return;
  // Reactivar vuelve al estado previo a la pausa (una prueba sigue siendo prueba).
  let next: "suspended" | "cancelled" | "trial" | "active" | "grace" = status;
  if (status === "active") {
    const paused = await db().license_events.findFirst({
      where: { license_id: license.id, type: { in: ["suspended", "cancelled"] } },
      orderBy: { created_at: "desc" },
      select: { data: true },
    });
    const from = (paused?.data as { from?: string } | null)?.from;
    if (from === "trial" || from === "grace") next = from;
  }
  await db().licenses.update({
    where: { id: license.id },
    data: { status: next, updated_by: ctx.actorId },
  });
  const type =
    status === "suspended" ? "suspended" : status === "cancelled" ? "cancelled" : "reactivated";
  await record(businessId, license.id, type, { from: license.status, to: next, reason }, ctx);
}

/** Plan y periodo con que se envió la boleta (evento payment_submitted). */
async function submittedTerms(paymentId: string) {
  const event = await db().license_events.findFirst({
    where: { type: "payment_submitted", data: { path: ["payment_id"], equals: paymentId } },
    select: { data: true },
  });
  const d = (event?.data ?? {}) as { plan?: string; period?: string };
  return {
    plan: d.plan === "pro" || d.plan === "negocio" ? d.plan : null,
    period: (d.period === "annual" ? "annual" : "monthly") as BillingPeriod,
  };
}

async function notifyOwner(businessId: string, subject: string, text: string) {
  if (!emailEnabled()) return;
  const owners = await db().$queryRaw<{ email: string }[]>`
    SELECT u.email FROM business_members m JOIN auth.users u ON u.id = m.user_id
    WHERE m.business_id = ${businessId}::uuid AND m.role = 'owner' AND u.email IS NOT NULL`;
  const link = new URL(`/panel/${businessId}/ajustes/licencia`, BRAND.url).toString();
  for (const { email } of owners)
    await sendEmail({
      to: email,
      fromName: BRAND.name,
      subject,
      text: `${text}\n\n${link}`,
      html: `<p>${text.replace(/</g, "&lt;")}</p><p><a href="${link}">Ver Mi plan</a></p>`,
    }).catch((error: unknown) => console.error("[admin] Aviso al dueño no enviado:", error));
}

/**
 * Verificar: la licencia pasa al plan pagado y queda activa hasta el fin del
 * periodo (desde el fin actual si aún no vencía); lo oculto vuelve a verse.
 */
export async function verifyPayment(paymentId: string, ctx: Ctx) {
  const payment = await db().payments.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      status: true,
      amount_cents: true,
      license: { select: { id: true, business_id: true, plan_id: true, ends_at: true } },
    },
  });
  if (!payment) throw new AppError("not_found", "Ese pago no existe.");
  if (payment.status !== "pending") throw new AppError("conflict", "Ese pago ya se revisó.");
  const { plan, period } = await submittedTerms(payment.id);
  const license = payment.license;
  const planId = plan ?? (license.plan_id === FREE_PLAN ? "pro" : license.plan_id);
  const { start, end } = nextPeriod(license.ends_at, period);

  await db().$transaction(async (tx) => {
    await tx.payments.update({
      where: { id: payment.id },
      data: { status: "verified", verified_by: ctx.actorId, period_start: start, period_end: end },
    });
    await tx.licenses.update({
      where: { id: license.id },
      data: { plan_id: planId, status: "active", ends_at: end, updated_by: ctx.actorId },
    });
    await restoreHidden(tx, license.business_id);
  });
  await record(
    license.business_id,
    license.id,
    "payment_verified",
    { payment_id: payment.id, plan: planId, period, ends_at: end.toISOString() },
    ctx,
  );
  await notifyOwner(
    license.business_id,
    `Pago verificado: ${formatQ(payment.amount_cents)}`,
    `Verificamos tu pago. Tu plan queda activo hasta el ${end.toISOString().slice(0, 10)}. ¡Gracias!`,
  );
  return { endsAt: end, planId };
}

export async function rejectPayment(paymentId: string, reason: string, ctx: Ctx) {
  const payment = await db().payments.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, license: { select: { id: true, business_id: true } } },
  });
  if (!payment) throw new AppError("not_found", "Ese pago no existe.");
  if (payment.status !== "pending") throw new AppError("conflict", "Ese pago ya se revisó.");
  await db().payments.update({
    where: { id: payment.id },
    data: { status: "rejected", rejection_reason: reason, verified_by: ctx.actorId },
  });
  await record(
    payment.license.business_id,
    payment.license.id,
    "payment_rejected",
    { payment_id: payment.id, reason },
    ctx,
  );
  await notifyOwner(
    payment.license.business_id,
    "No pudimos verificar tu pago",
    `Revisamos tu boleta y no pudimos verificarla: ${reason}`,
  );
}

/** Pago manual (depósito en efectivo, sin boleta): se registra ya verificado. */
export async function registerManualPayment(
  input: {
    businessId: string;
    planId: "pro" | "negocio";
    period: BillingPeriod;
    amountCents: number;
    reference: string;
  },
  ctx: Ctx,
) {
  const license = await licenseOf(input.businessId);
  const { start, end } = nextPeriod(license.ends_at, input.period);
  const payment = await db().$transaction(async (tx) => {
    const created = await tx.payments.create({
      data: {
        license_id: license.id,
        amount_cents: input.amountCents,
        method: "deposit",
        reference: input.reference,
        period_start: start,
        period_end: end,
        status: "verified",
        verified_by: ctx.actorId,
      },
      select: { id: true },
    });
    await tx.licenses.update({
      where: { id: license.id },
      data: { plan_id: input.planId, status: "active", ends_at: end, updated_by: ctx.actorId },
    });
    await restoreHidden(tx, input.businessId);
    return created;
  });
  await record(
    input.businessId,
    license.id,
    "payment_verified",
    {
      payment_id: payment.id,
      plan: input.planId,
      period: input.period,
      manual: true,
      ends_at: end.toISOString(),
    },
    ctx,
  );
  return { endsAt: end };
}
