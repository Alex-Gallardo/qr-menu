"use server";

import { after } from "next/server";
import { validationError, z } from "@/lib/zod";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { db } from "@/lib/db";
import { paymentSchema, receiptUploadSchema } from "./schemas";
import { notifyAdminsOfPayment, receiptViewUrl, signReceiptUpload, submitPayment } from "./server";

/*
 * Pagos de la licencia: solo el dueño. Sin `write`: una cuenta en pausa o
 * vencida también tiene que poder pagar.
 */

export async function createReceiptUpload(
  input: unknown,
): Promise<ActionResult<{ signedUrl: string; path: string }>> {
  const parsed = receiptUploadSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    await requireAccess(parsed.data.businessId, { roles: ["owner"] });
    return { ok: true, data: await signReceiptUpload(parsed.data.businessId, parsed.data.type) };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { user } = await requireAccess(parsed.data.businessId, { roles: ["owner"] });
    const payment = await submitPayment(parsed.data, { actorId: user.id });
    // El aviso al admin no hace esperar al dueño.
    after(() =>
      notifyAdminsOfPayment(payment.id).catch((error: unknown) =>
        console.error("[billing] No se pudo avisar al admin:", error),
      ),
    );
    return {
      ok: true,
      message: "¡Recibimos tu boleta! La verificamos en horario hábil y te avisamos aquí.",
    };
  } catch (error) {
    return actionError(error);
  }
}

/** Ver la boleta que subió (link de 10 minutos). */
export async function receiptLinkAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = z.object({ businessId: z.uuid(), paymentId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "No encontramos esa boleta." };
  try {
    await requireAccess(parsed.data.businessId, { roles: ["owner"] });
    const payment = await db().payments.findFirst({
      where: { id: parsed.data.paymentId, license: { business_id: parsed.data.businessId } },
      select: { receipt_url: true },
    });
    const url = payment?.receipt_url ? await receiptViewUrl(payment.receipt_url) : null;
    if (!url) return { ok: false, message: "Esa boleta ya no está disponible." };
    return { ok: true, data: { url } };
  } catch (error) {
    return actionError(error);
  }
}
