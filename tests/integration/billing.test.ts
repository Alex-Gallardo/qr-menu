import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { paymentSchema } from "@/features/billing/schemas";
import {
  getBillingPage,
  hasPendingPayment,
  listPendingPayments,
  receiptViewUrl,
  signReceiptUpload,
  submitPayment,
} from "@/features/billing/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** QRM-041: la boleta se sube al bucket privado y llega al admin. */

const DAY = 24 * 60 * 60 * 1000;
const SLUG = "zz-test-qrm041-plan";
const actorId = randomUUID();
let businessId: string;
let trialEnds: Date;
const uploaded: string[] = [];

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e as AppError,
  );

async function uploadReceipt() {
  const { signedUrl, path } = await signReceiptUpload(businessId, "image/jpeg");
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: new Uint8Array(2048),
  });
  expect(res.ok).toBe(true);
  uploaded.push(path);
  return path;
}

const payment = (receiptPath: string, over: Record<string, unknown> = {}) =>
  paymentSchema.parse({
    businessId,
    planId: "pro",
    period: "monthly",
    method: "transfer",
    bank: "Banco Industrial",
    reference: "TRX-0001",
    amount: "149",
    receiptPath,
    ...over,
  });

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  trialEnds = new Date(Date.now() + 10 * DAY);
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba plan",
      license: { create: { plan_id: "pro", status: "trial", ends_at: trialEnds } },
    },
    select: { id: true },
  });
  businessId = biz.id;
});

afterAll(async () => {
  if (uploaded.length) await createSupabaseAdminClient().storage.from("receipts").remove(uploaded);
  if (businessId) await db().audit_logs.deleteMany({ where: { business_id: businessId } });
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().$disconnect();
});

describe("Mi plan", () => {
  it("página: plan, uso y pagos (vacío al inicio)", async () => {
    const page = await getBillingPage(businessId);
    expect(page.entitlements).toMatchObject({ status: "trial", planId: "pro" });
    expect(page.usage.branches).toBe(0);
    expect(page.license?.payments).toEqual([]);
    expect(page.plans.map((p) => p.id)).toEqual(["gratis", "pro", "negocio"]);
  });

  it("la boleta va al bucket privado: sin link público, solo URL firmada", async () => {
    const path = await uploadReceipt();
    expect(path.startsWith(`${businessId}/`)).toBe(true);
    const publicUrl = createSupabaseAdminClient().storage.from("receipts").getPublicUrl(path)
      .data.publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(false);
    const signed = await receiptViewUrl(path);
    expect(signed).toBeTruthy();
    expect((await fetch(signed!)).ok).toBe(true);
  });

  it("enviar: queda en verificación, cubre desde el fin de la prueba y llega al admin", async () => {
    const path = await uploadReceipt();
    const created = await submitPayment(payment(path), { actorId });
    const row = await db().payments.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({
      status: "pending",
      amount_cents: 14_900,
      method: "transfer",
      reference: "TRX-0001",
      receipt_url: path,
    });
    expect(row.period_start.getTime()).toBe(trialEnds.getTime());
    expect(row.period_end.getUTCMonth()).toBe((trialEnds.getUTCMonth() + 1) % 12);
    const event = await db().license_events.findFirst({
      where: { type: "payment_submitted", license: { business_id: businessId } },
    });
    expect(event?.data).toMatchObject({ payment_id: created.id, plan: "pro", period: "monthly" });
    expect(await hasPendingPayment(businessId)).toBe(true);

    const pending = await listPendingPayments();
    const mine = pending.find((p) => p.id === created.id);
    expect(mine?.license.business.name).toBe("Prueba plan");
    expect(mine?.receiptLink).toContain("/receipts/");
  });

  it("rechaza boletas de otra carpeta o que no se subieron", async () => {
    const foreign = await failure(submitPayment(payment(`${randomUUID()}/x.jpg`), { actorId }));
    expect(foreign?.code).toBe("forbidden");
    const missing = await failure(
      submitPayment(payment(`${businessId}/${randomUUID()}.jpg`), { actorId }),
    );
    expect(missing?.code).toBe("not_found");
  });

  it("máximo 3 boletas en verificación a la vez", async () => {
    await submitPayment(payment(await uploadReceipt(), { reference: "TRX-0002" }), { actorId });
    await submitPayment(payment(await uploadReceipt(), { reference: "TRX-0003" }), { actorId });
    const fourth = await failure(
      submitPayment(payment(await uploadReceipt(), { reference: "TRX-0004" }), { actorId }),
    );
    expect(fourth?.code).toBe("too_many");
    expect(
      await db().audit_logs.count({ where: { business_id: businessId, action: "payment.submit" } }),
    ).toBe(3);
  });
});
