import "server-only";
import { randomUUID } from "node:crypto";
import { getEntitlements, getUsage } from "@/features/licensing/server";
import type { LimitedResource } from "@/features/licensing/plan-catalog";
import { audit } from "@/lib/audit";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { emailEnabled, sendEmail } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { formatQ, parseQ } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MAX_PENDING_PAYMENTS, nextPeriod, type BillingPeriod } from "./billing";
import type { PaymentInput } from "./schemas";

const BUCKET = "receipts";
const RESOURCES: LimitedResource[] = [
  "branches",
  "products",
  "menus",
  "time_slots",
  "qr",
  "managers",
  "staff",
  "storage_mb",
];
const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

export type PaymentAccount = { bank: string; type: string; number: string; holder: string };

/** Cuentas de la plataforma para pagar (platform_settings.payment_accounts; las edita el super admin). */
export async function getPaymentAccounts(): Promise<PaymentAccount[]> {
  const row = await db().platform_settings.findUnique({
    where: { key: "payment_accounts" },
    select: { value: true },
  });
  const list = Array.isArray(row?.value) ? row.value : [];
  return list.flatMap((a) => {
    const v = a as Partial<PaymentAccount>;
    return v && typeof v.bank === "string" && typeof v.number === "string"
      ? [{ bank: v.bank, type: v.type ?? "", number: v.number, holder: v.holder ?? "" }]
      : [];
  });
}

/** Todo lo de Ajustes → Mi plan. */
export async function getBillingPage(businessId: string) {
  const [entitlements, license, plans, accounts, usageList] = await Promise.all([
    getEntitlements(businessId),
    db().licenses.findUnique({
      where: { business_id: businessId },
      select: {
        id: true,
        plan_id: true,
        price_override_gtq: true,
        ends_at: true,
        payments: {
          orderBy: { created_at: "desc" },
          take: 20,
          select: {
            id: true,
            amount_cents: true,
            method: true,
            bank: true,
            reference: true,
            period_start: true,
            period_end: true,
            status: true,
            rejection_reason: true,
            created_at: true,
          },
        },
      },
    }),
    db().plans.findMany({
      where: { is_public: true },
      orderBy: { sort: "asc" },
      select: { id: true, name: true, price_gtq: true, features: true, sort: true },
    }),
    getPaymentAccounts(),
    Promise.all(RESOURCES.map((r) => getUsage(businessId, r))),
  ]);
  const usage = Object.fromEntries(RESOURCES.map((r, i) => [r, usageList[i]!])) as Record<
    LimitedResource,
    number
  >;
  return { entitlements, license, plans, accounts, usage };
}

/** URL firmada (2 h) para subir la boleta al bucket privado: {negocio}/{uuid}.{ext}. */
export async function signReceiptUpload(businessId: string, type: string) {
  const ext = EXT[type];
  if (!ext) throw new AppError("validation", "Sube una foto (JPG, PNG) o un PDF.");
  const path = `${businessId}/${randomUUID()}.${ext}`;
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data)
    throw new AppError("storage", "No pudimos preparar la subida. Probemos otra vez.");
  return { signedUrl: data.signedUrl, path };
}

/** URL corta (10 min) para ver una boleta (el dueño la suya; el admin, cualquiera). */
export async function receiptViewUrl(path: string) {
  const { data } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/**
 * Registra la boleta: la foto debe estar subida en la carpeta del negocio; el
 * pago queda "En verificación" con el periodo que cubriría y le avisa al admin.
 */
export async function submitPayment(input: PaymentInput, { actorId }: { actorId: string }) {
  const { businessId } = input;
  if (!input.receiptPath.startsWith(`${businessId}/`))
    throw new AppError("forbidden", "Esa boleta no es de tu negocio.");
  const license = await db().licenses.findUnique({
    where: { business_id: businessId },
    select: { id: true, ends_at: true },
  });
  if (!license) throw new AppError("not_found", "No encontramos tu licencia. Escríbenos.");

  const pending = await db().payments.count({
    where: { license_id: license.id, status: "pending" },
  });
  if (pending >= MAX_PENDING_PAYMENTS)
    throw new AppError(
      "too_many",
      "Ya tienes boletas en verificación. Te avisamos apenas las revisemos.",
    );

  const folder = input.receiptPath.slice(0, input.receiptPath.lastIndexOf("/"));
  const name = input.receiptPath.slice(folder.length + 1);
  const { data: files } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .list(folder, { search: name, limit: 1 });
  if (!files?.some((f) => f.name === name))
    throw new AppError("not_found", "No encontramos la boleta subida. Súbela otra vez.");

  const { start, end } = nextPeriod(license.ends_at, input.period as BillingPeriod);
  const payment = await db().$transaction(async (tx) => {
    const created = await tx.payments.create({
      data: {
        license_id: license.id,
        amount_cents: parseQ(input.amount)!,
        method: input.method,
        bank: input.bank,
        reference: input.reference,
        receipt_url: input.receiptPath,
        period_start: start,
        period_end: end,
      },
      select: { id: true, amount_cents: true },
    });
    await tx.license_events.create({
      data: {
        license_id: license.id,
        type: "payment_submitted",
        actor_id: actorId,
        data: { payment_id: created.id, plan: input.planId, period: input.period },
      },
    });
    return created;
  });
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "payment.submit",
    entity: "payments",
    entityId: payment.id,
    diff: { amount: formatQ(payment.amount_cents), plan: input.planId, period: input.period },
  });
  return payment;
}

/** Correo al equipo de la plataforma (admins) con la boleta nueva; si no hay correo, solo queda en /admin. */
export async function notifyAdminsOfPayment(paymentId: string) {
  if (!emailEnabled()) return false;
  const payment = await db().payments.findUnique({
    where: { id: paymentId },
    select: {
      amount_cents: true,
      reference: true,
      bank: true,
      license: { select: { plan_id: true, business: { select: { name: true } } } },
    },
  });
  if (!payment) return false;
  const admins = await db().$queryRaw<{ email: string }[]>`
    SELECT u.email FROM auth.users u JOIN profiles p ON p.id = u.id
    WHERE p.platform_role = 'admin' AND u.email IS NOT NULL`;
  const business = payment.license.business.name;
  const amount = formatQ(payment.amount_cents);
  const link = new URL("/admin", BRAND.url).toString();
  await Promise.all(
    admins.map((a) =>
      sendEmail({
        to: a.email,
        fromName: BRAND.name,
        subject: `Boleta por verificar: ${business} · ${amount}`,
        text: `${business} subió una boleta de ${amount} (${payment.bank ?? "banco"}, ref. ${payment.reference}) para el plan ${payment.license.plan_id}.\n\nRevísala en ${link}`,
        html: `<p><strong>${business.replace(/</g, "&lt;")}</strong> subió una boleta de <strong>${amount}</strong> (${(payment.bank ?? "banco").replace(/</g, "&lt;")}, ref. ${payment.reference.replace(/</g, "&lt;")}) para el plan ${payment.license.plan_id}.</p><p><a href="${link}">Revisarla en el super admin</a></p>`,
      }),
    ),
  );
  return admins.length > 0;
}

/** Pagos por verificar (lista provisional de /admin hasta QRM-042). */
export async function listPendingPayments() {
  const rows = await db().payments.findMany({
    where: { status: "pending" },
    orderBy: { created_at: "asc" },
    take: 50,
    select: {
      id: true,
      amount_cents: true,
      method: true,
      bank: true,
      reference: true,
      receipt_url: true,
      period_start: true,
      period_end: true,
      created_at: true,
      license: {
        select: { plan_id: true, business: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      receiptLink: r.receipt_url ? await receiptViewUrl(r.receipt_url) : null,
    })),
  );
}

/** ¿Hay una boleta en verificación? (banner del panel). */
export async function hasPendingPayment(businessId: string) {
  const count = await db().payments.count({
    where: { status: "pending", license: { business_id: businessId } },
  });
  return count > 0;
}
