import "server-only";
import { BRAND } from "@/lib/brand";

/**
 * Envío de correos con la API de Resend (un POST con fetch: sin SDK).
 * Sin RESEND_API_KEY no se envía nada (desarrollo, previews sin configurar) y
 * la app sigue igual. Remitente: "Café El Portal vía QR Menu <pedidos@…>".
 */

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

/** pedidos@{dominio de la app}, o el remitente configurado en EMAIL_FROM. */
export function senderAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  const host = new URL(BRAND.url).hostname.replace(/^www\./, "");
  return `pedidos@${host}`;
}

/** Nombre visible sin caracteres que rompan el encabezado From. */
const displayName = (name: string) =>
  name
    .replace(/["<>\r\n]/g, "")
    .trim()
    .slice(0, 80);

export type SendResult = { sent: true; id: string } | { sent: false; reason: "disabled" };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** "Café El Portal" → "Café El Portal vía QR Menu". */
  fromName: string;
  replyTo?: string | null;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "disabled" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `"${displayName(`${input.fromName} vía ${BRAND.name}`)}" <${senderAddress()}>`,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // El cuerpo de error de Resend no trae datos del destinatario.
    throw new Error(
      `Resend respondió ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  const body = (await response.json()) as { id?: string };
  return { sent: true, id: body.id ?? "" };
}
