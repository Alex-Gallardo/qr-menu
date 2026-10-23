/**
 * Asistente de alta (guía D1, "menos de 10 minutos"), puro: los 4 pasos, a
 * cuál volver si se sale a medias, el mensaje de prueba de WhatsApp, los
 * productos de ejemplo y la lista final.
 */

export const ONBOARDING_STEPS = [
  { step: 1, title: "Tu negocio", hint: "Nombre, link y tu primera sucursal" },
  { step: 2, title: "Tu marca", hint: "Logo, colores y bienvenida" },
  { step: 3, title: "Tus productos", hint: "Los primeros 5" },
  { step: 4, title: "Publicar", hint: "Tu menú y tu QR" },
] as const;

export type Step = 1 | 2 | 3 | 4;

export type OnboardingProgress = {
  hasBusiness: boolean;
  hasLogo: boolean;
  products: number;
  published: boolean;
};

/** Hasta qué paso puede llegar (no se salta pasos con datos que faltan). */
export function maxStep(p: OnboardingProgress): Step {
  if (!p.hasBusiness) return 1;
  if (p.products === 0) return 3;
  return 4;
}

/** Paso al volver sin indicar uno: donde se quedó. */
export function resumeStep(p: OnboardingProgress): Step {
  if (!p.hasBusiness) return 1;
  if (p.products > 0) return 4;
  return p.hasLogo ? 3 : 2;
}

/** ?paso=… válido y alcanzable; si no, donde se quedó. */
export function parseStep(raw: string | null | undefined, p: OnboardingProgress): Step {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 4) return resumeStep(p);
  return Math.min(n, maxStep(p)) as Step;
}

/**
 * "Enviar mensaje de prueba": abre WhatsApp hacia el número de la sucursal
 * (api.whatsapp.com: wa.me rompe los emojis). Si el mensaje llega a ese
 * celular, ahí mismo llegarán los pedidos.
 */
export function whatsappTestUrl(e164: string, brandName: string) {
  const text = `¡Hola! Este es un mensaje de prueba de ${brandName} ✅ Si te llegó a este número, aquí mismo te llegarán los pedidos de tu menú.`;
  return `https://api.whatsapp.com/send?phone=${e164.replace(/\D/g, "")}&text=${encodeURIComponent(text)}`;
}

export const MAX_FIRST_PRODUCTS = 5;

/** "Usar ejemplos": se pueden editar o borrar después en Productos. */
export const SAMPLE_PRODUCTS = [
  { name: "Desayuno chapín", price: "45" },
  { name: "Café americano", price: "15" },
  { name: "Licuado de fresa", price: "22" },
  { name: "Sándwich de pollo", price: "35" },
  { name: "Pastel de chocolate", price: "25" },
] as const;

export type ChecklistInput = {
  hoursCustomized: boolean;
  products: number;
  bankAccounts: number;
  pushDevices: number;
  teamMembers: number;
};

/** Lista final (guía D1.6): lo que conviene hacer después de publicar. */
export function checklist(c: ChecklistInput) {
  return [
    {
      key: "horarios",
      label: "Revisa tus horarios",
      hint: "Empezamos con lunes a sábado de 8:00 a 20:00.",
      segment: "sucursales",
      done: c.hoursCustomized,
    },
    {
      key: "productos",
      label: "Agrega más productos",
      hint: "Con foto y opciones como tamaño o extras.",
      segment: "productos",
      done: c.products > MAX_FIRST_PRODUCTS,
    },
    {
      key: "pagos",
      label: "Agrega tus cuentas bancarias",
      hint: "Para que te paguen por transferencia.",
      segment: "ajustes/pagos",
      done: c.bankAccounts > 0,
    },
    {
      key: "avisos",
      label: "Activa los avisos de pedidos",
      hint: "En este celular o en la tablet de la caja.",
      segment: "ajustes/notificaciones",
      done: c.pushDevices > 0,
    },
    {
      key: "equipo",
      label: "Invita a tu equipo",
      hint: "Encargados por sucursal y staff con PIN.",
      segment: "equipo",
      done: c.teamMembers > 0,
    },
  ];
}

/** Minutos enteros entre el alta y la publicación (meta: mediana ≤ 15). */
export function minutesToPublish(createdAt: Date, publishedAt: Date) {
  return Math.max(0, Math.round((publishedAt.getTime() - createdAt.getTime()) / 60_000));
}
