import "server-only";
import { captureException } from "@sentry/nextjs";
import { BRAND } from "@/lib/brand";
import { readableTextOn } from "@/lib/color";
import { db } from "@/lib/db";
import { sendEmail, type SendResult } from "@/lib/email";
import { buildConfirmationEmail } from "./email-template";
import { getCustomerOrder } from "./queries";

type Skipped = {
  sent: false;
  reason: "no_email" | "already_sent" | "not_found" | "disabled" | "error";
};

/**
 * Correo de confirmación al comensal (solo si dejó su correo; nunca al
 * negocio ni al staff). Corre después de responder (after) para no hacer
 * esperar a nadie. Se marca antes de enviar para no mandarlo dos veces; si
 * Resend falla, se desmarca y el error va a Sentry.
 */
export async function sendOrderConfirmation(orderId: string): Promise<SendResult | Skipped> {
  const row = await db().orders.findUnique({
    where: { id: orderId },
    select: {
      customer_email: true,
      confirmation_sent_at: true,
      branch: { select: { slug: true } },
      business: { select: { slug: true, email: true } },
    },
  });
  if (!row) return { sent: false, reason: "not_found" };
  if (!row.customer_email) return { sent: false, reason: "no_email" };
  if (row.confirmation_sent_at) return { sent: false, reason: "already_sent" };
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "disabled" };

  const claimed = await db().orders.updateMany({
    where: { id: orderId, confirmation_sent_at: null },
    data: { confirmation_sent_at: new Date() },
  });
  if (claimed.count === 0) return { sent: false, reason: "already_sent" };

  try {
    const data = await getCustomerOrder(row.business.slug, row.branch.slug, orderId);
    if (!data) throw new Error("Pedido no encontrado al armar el correo");
    const email = buildConfirmationEmail({
      order: data.order,
      statusUrl: data.order.detailUrl,
      branchWhatsapp: data.branch.whatsapp,
      bankAccounts: data.bankAccounts,
      logoUrl: data.business.logoUrl,
      primaryColor: data.business.theme.primary,
      onPrimaryColor: readableTextOn(data.business.theme.primary),
      brandName: BRAND.name,
    });
    return await sendEmail({
      to: row.customer_email,
      ...email,
      fromName: data.business.name,
      replyTo: row.business.email,
    });
  } catch (error) {
    await db().orders.update({ where: { id: orderId }, data: { confirmation_sent_at: null } });
    captureException(error, { tags: { feature: "order_confirmation_email" } });
    console.error("[correo de confirmación]", error instanceof Error ? error.message : error);
    return { sent: false, reason: "error" };
  }
}
