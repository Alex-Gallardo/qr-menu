/** Correo de invitación de encargado (HTML simple + texto). Puro. */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildInviteEmail(data: {
  businessName: string;
  inviterName: string | null;
  branches: string;
  link: string;
  brandName: string;
  days: number;
}) {
  const who = data.inviterName ? `${data.inviterName} te invita` : "Te invitan";
  const subject = `${who} al equipo de ${data.businessName}`;
  const text = [
    `${who} a ser encargado de ${data.businessName} en ${data.brandName}.`,
    `Sucursales: ${data.branches}.`,
    "",
    `Acepta aquí (vale ${data.days} días): ${data.link}`,
    "",
    "Si no esperabas este correo, ignóralo.",
  ].join("\n");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#FBF6EE;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#231A17">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<h1 style="font-size:22px;margin:0 0 12px">${esc(who)} al equipo de ${esc(data.businessName)}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 8px">Como encargado vas a ver y atender los pedidos, y manejar el menú de: <strong>${esc(data.branches)}</strong>.</p>
<p style="margin:24px 0"><a href="${esc(data.link)}" style="display:inline-block;background:#D23B22;color:#fff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:999px">Aceptar invitación</a></p>
<p style="font-size:14px;line-height:1.5;color:#6B5B55;margin:0">El enlace vale ${data.days} días. Si no esperabas este correo, ignóralo.</p>
</div></body></html>`;
  return { subject, html, text };
}
