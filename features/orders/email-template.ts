import { formatQ } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { ORDER_TYPE_LABELS, PAY_METHOD_LABELS } from "./checkout";
import { scheduledLabel } from "./preorder";
import { orderNumberLabel, type MessageOrder } from "./whatsapp";

/**
 * Correo "Recibimos tu pedido" (puro): asunto, HTML para clientes de correo
 * (tablas y estilos en línea, sin imágenes externas salvo el logo) y versión
 * de texto. Solo va al comensal que dejó su correo; nunca al negocio. Todo lo
 * que escribió el comensal o el negocio se escapa.
 */

export type ConfirmationAccount = {
  bankName: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  instructions: string | null;
};

export type ConfirmationEmailData = {
  order: MessageOrder;
  /** Página de estado del pedido. */
  statusUrl: string;
  /** Chat de WhatsApp de la sucursal (sin mensaje). */
  branchWhatsapp: string;
  bankAccounts: ConfirmationAccount[];
  logoUrl: string | null;
  primaryColor: string;
  onPrimaryColor: string;
  brandName: string;
};

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Solo colores #RRGGBB en los estilos (vienen ya normalizados, pero por si acaso). */
const color = (value: string, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

export function confirmationSubject(
  order: Pick<MessageOrder, "number" | "businessName" | "branchName">,
) {
  return `Recibimos tu pedido ${orderNumberLabel(order.number)} en ${order.businessName} · ${order.branchName}`;
}

function whenLabel(order: MessageOrder, now: Date) {
  const type = [
    ORDER_TYPE_LABELS[order.orderType],
    order.orderType === "dine_in" ? order.tableLabel : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const when = order.scheduledFor
    ? `Programado para ${scheduledLabel(order.scheduledFor.toISOString(), now)}`
    : "Lo antes posible";
  return `${type} · ${when}`;
}

export function buildConfirmationEmail(data: ConfirmationEmailData, now: Date = new Date()) {
  const { order } = data;
  const primary = color(data.primaryColor, "#D23B22");
  const onPrimary = color(data.onPrimaryColor, "#FFFFFF");
  const number = orderNumberLabel(order.number);
  const subject = confirmationSubject(order);
  const whatsapp = `https://api.whatsapp.com/send?phone=${data.branchWhatsapp.replace(/\D/g, "")}`;
  const transfer = order.payment === "transfer" && data.bankAccounts.length > 0;

  // ── Texto plano ──
  const text = [
    `¡Hola, ${order.customerName}!`,
    "",
    `Recibimos tu pedido ${number} en ${order.businessName} · ${order.branchName}.`,
    whenLabel(order, now),
    "",
    ...order.items.flatMap((i) => [
      `${i.quantity}× ${i.name} — ${formatQ(i.lineCents)}`,
      ...i.options.map(
        (o) =>
          `   • ${o.deltaCents > 0 ? `${o.name} (+${formatQ(o.deltaCents)})` : `${o.group}: ${o.name}`}`,
      ),
    ]),
    "",
    ...(order.deliveryFeeCents > 0
      ? [`Subtotal: ${formatQ(order.subtotalCents)}`, `Envío: ${formatQ(order.deliveryFeeCents)}`]
      : []),
    `Total: ${formatQ(order.totalCents)}`,
    `Pago: ${PAY_METHOD_LABELS[order.payment]}`,
    ...(order.orderType === "delivery" && order.address
      ? [
          "",
          `Entrega en: ${order.address}`,
          ...(order.addressReference ? [`Referencia: ${order.addressReference}`] : []),
        ]
      : []),
    ...(transfer
      ? [
          "",
          `Para pagar por transferencia (${formatQ(order.totalCents)}):`,
          ...data.bankAccounts.flatMap((a) => [
            `${a.bankName} · ${a.accountType} · ${a.accountNumber} · a nombre de ${a.holderName}`,
            ...(a.instructions ? [a.instructions] : []),
          ]),
          "Manda la foto de tu boleta por WhatsApp con tu número de pedido.",
        ]
      : []),
    "",
    `Mira el estado de tu pedido: ${data.statusUrl}`,
    `WhatsApp de la sucursal: ${formatPhone(data.branchWhatsapp)} (${whatsapp})`,
    "",
    `Te enviamos este correo porque lo dejaste al pedir. Enviado por ${data.brandName} en nombre de ${order.businessName}.`,
  ].join("\n");

  // ── HTML ──
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:2px 0;color:#7a6a60;font-size:14px">${esc(label)}</td><td style="padding:2px 0;text-align:right;font-size:${strong ? "18px;font-weight:700" : "14px"};color:#231a17">${esc(value)}</td></tr>`;

  const items = order.items
    .map((i) => {
      const options = i.options
        .map((o) =>
          o.deltaCents > 0 ? `${o.name} (+${formatQ(o.deltaCents)})` : `${o.group}: ${o.name}`,
        )
        .join(", ");
      return `<tr>
  <td style="padding:8px 0;border-bottom:1px solid #f1ebe3;font-size:15px;color:#231a17">${i.quantity}× ${esc(i.name)}${
    options ? `<div style="font-size:13px;color:#7a6a60">${esc(options)}</div>` : ""
  }${i.note ? `<div style="font-size:13px;color:#7a6a60;font-style:italic">“${esc(i.note)}”</div>` : ""}</td>
  <td style="padding:8px 0;border-bottom:1px solid #f1ebe3;text-align:right;font-size:15px;color:#231a17;white-space:nowrap">${formatQ(i.lineCents)}</td>
</tr>`;
    })
    .join("");

  const accounts = transfer
    ? `<tr><td style="padding:16px 24px 0">
  <div style="border:1px solid #e6ddd2;border-radius:12px;padding:16px">
    <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#231a17">Para pagar por transferencia (${formatQ(order.totalCents)})</p>
    ${data.bankAccounts
      .map(
        (a) =>
          `<p style="margin:0 0 10px;font-size:14px;color:#231a17">${esc(a.bankName)} · ${esc(a.accountType)}<br><strong style="font-size:16px;letter-spacing:.5px">${esc(a.accountNumber)}</strong><br><span style="color:#7a6a60">A nombre de ${esc(a.holderName)}</span>${
            a.instructions ? `<br>${esc(a.instructions)}` : ""
          }</p>`,
      )
      .join("")}
    <p style="margin:0;font-size:13px;color:#7a6a60">Manda la foto de tu boleta por WhatsApp con tu número de pedido.</p>
  </div>
</td></tr>`
    : "";

  const address =
    order.orderType === "delivery" && order.address
      ? `<p style="margin:12px 0 0;font-size:14px;color:#231a17">📍 ${esc(order.address)}${
          order.addressReference
            ? `<br><span style="color:#7a6a60">Referencia: ${esc(order.addressReference)}</span>`
            : ""
        }</p>`
      : "";

  const button = (href: string, label: string, bg: string, fg: string) =>
    `<a href="${esc(href)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:${bg};color:${fg};font-size:15px;font-weight:700;text-decoration:none;margin:4px">${esc(label)}</a>`;

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#fbf6ee;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${esc(`${number} · ${formatQ(order.totalCents)} · ${whenLabel(order, now)}`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf6ee;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td style="background:${primary};padding:24px;text-align:center;color:${onPrimary}">
    ${data.logoUrl ? `<img src="${esc(data.logoUrl)}" width="56" height="56" alt="" style="border-radius:999px;background:#fff;display:inline-block">` : ""}
    <p style="margin:8px 0 0;font-size:14px;opacity:.9">${esc(order.businessName)} · ${esc(order.branchName)}</p>
    <h1 style="margin:4px 0 0;font-size:24px;line-height:1.2">¡Recibimos tu pedido ${number}!</h1>
  </td></tr>
  <tr><td style="padding:24px 24px 0">
    <p style="margin:0;font-size:16px;color:#231a17">Hola, ${esc(order.customerName)}. Este es el resumen de tu pedido.</p>
    <p style="margin:8px 0 0;font-size:14px;color:#7a6a60">${esc(whenLabel(order, now))}</p>
    ${address}
  </td></tr>
  <tr><td style="padding:16px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
      ${order.deliveryFeeCents > 0 ? row("Subtotal", formatQ(order.subtotalCents)) + row("Envío", formatQ(order.deliveryFeeCents)) : ""}
      ${row("Total", formatQ(order.totalCents), true)}
      ${row("Pago", PAY_METHOD_LABELS[order.payment])}
    </table>
  </td></tr>
  ${accounts}
  <tr><td style="padding:24px;text-align:center">
    ${button(data.statusUrl, "Ver mi pedido", primary, onPrimary)}
    ${button(whatsapp, "WhatsApp de la sucursal", "#25D366", "#231a17")}
  </td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#7a6a60;text-align:center">Te enviamos este correo porque lo dejaste al pedir. No lo usamos para publicidad.<br>Enviado por ${esc(data.brandName)} en nombre de ${esc(order.businessName)}.</p>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
