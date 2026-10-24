/**
 * Landing (guía §10), puro: textos, preguntas, comparativa y planes. Cada
 * bloque responde una objeción real del dueño: ¿es difícil?, ¿cuánto cuesta?,
 * ¿mis clientes lo van a usar?, ¿sirve si tengo varios locales?
 */
import { FEATURE_LABELS } from "@/features/billing/billing";
import { PLAN_CATALOG, type PlanDefinition } from "@/features/licensing/plan-catalog";

export const HERO = {
  title: "Tu menú del día, a un toque",
  subtitle:
    "Crea el menú digital de tu restaurante con QR en 10 minutos, prográmalo para desayuno, almuerzo y cena, y recibe pedidos claros en el WhatsApp de cada sucursal. Sin comisiones.",
  micro: "14 días gratis · Sin tarjeta · Sin comisiones por pedido",
} as const;

/** SEO de la landing (≤ 60 y ≤ 155 caracteres). */
export function landingSeo(brandName: string) {
  return {
    title: `Menú digital QR con pedidos por WhatsApp · ${brandName}`,
    description:
      "Crea el menú digital de tu restaurante en Guatemala: QR, menú del día programado y pedidos a tu WhatsApp. Prueba gratis 14 días.",
  };
}

export const STEPS = [
  { title: "Sube tu menú", text: "Tus platillos con foto y precio, y cuándo se ve cada menú." },
  { title: "Imprime tu QR", text: "Uno por sucursal o por mesa, con tu logo y tus colores." },
  {
    title: "Recibe pedidos en WhatsApp",
    text: "Ordenados, con total, mesa o ubicación del cliente.",
  },
] as const;

export const BENEFITS = [
  { title: "Menú del día programado", text: "Desayuno, almuerzo y cena cambian solos a su hora." },
  { title: "Cambios al instante", text: "Agota un platillo o sube un precio sin reimprimir nada." },
  {
    title: "Pedidos claros",
    text: "Cada pedido llega completo, con la ubicación si es a domicilio.",
  },
  {
    title: "Tu marca",
    text: "Tus colores, tu logo y tu bienvenida; nada de plantillas genéricas.",
  },
  { title: "Reseñas en Google", text: "Invita a cada cliente a calificarte y a dejar su reseña." },
  { title: "Sin comisiones", text: "Pagas tu plan y ya: cada pedido es 100 % tuyo." },
] as const;

export const BRANCHES_BLOCK = {
  title: "¿Tienes varias sucursales?",
  text: "Un solo catálogo y cada local con su WhatsApp, su horario, su zona de entrega y su QR. Agotas en una sucursal sin tocar las demás.",
} as const;

export const AUDIENCES = [
  "Comedores y menús del día",
  "Cafeterías",
  "Pizzerías",
  "Food trucks",
  "Panaderías",
  "Dark kitchens",
] as const;

/** Carta impresa vs. foto del menú por WhatsApp vs. la app. */
export function comparisonRows(brandName: string) {
  return {
    columns: ["Carta impresa", "Foto por WhatsApp", brandName] as const,
    rows: [
      {
        label: "Cambiar el menú del día",
        values: ["Reimprimir", "Mandar otra foto", "Al instante"],
      },
      { label: "Precios al día", values: ["No", "A veces", "Siempre"] },
      { label: "Pedidos ordenados con total", values: ["No", "No", "Sí"] },
      { label: "Ubicación del cliente", values: ["No", "Si la manda", "Con un toque"] },
      { label: "Funciona sin instalar nada", values: ["Sí", "Sí", "Sí"] },
      { label: "Comisión por pedido", values: ["—", "—", "Ninguna"] },
    ],
  };
}

export const FAQ = [
  {
    q: "¿Cobran comisión por pedido?",
    a: "No. Pagas tu plan mensual o anual y todos los pedidos son tuyos.",
  },
  {
    q: "¿Necesito instalar algo?",
    a: "No. Tus clientes escanean el QR y el menú abre en el navegador. Tú lo manejas desde el celular o la computadora.",
  },
  {
    q: "¿Cómo pago?",
    a: "Por transferencia o depósito, mensual o anual. Subes la boleta en tu panel y la verificamos.",
  },
  {
    q: "¿Mis clientes pagan en la app?",
    a: "No. Te mandan el pedido por WhatsApp y pagan como siempre: efectivo, tarjeta en el local o transferencia a tus cuentas, que pueden ver en el pedido si quieres.",
  },
  {
    q: "¿Sirve para varias sucursales?",
    a: "Sí. Cada sucursal tiene su WhatsApp, horario, zona de entrega, QR y disponibilidad de productos.",
  },
  {
    q: "¿Puedo recibir pedidos cuando estoy cerrado?",
    a: "Sí, si lo activas: el cliente elige para cuándo lo quiere y te llega como pedido programado.",
  },
  {
    q: "¿Cómo cancelo?",
    a: "Cuando quieras: no renuevas y tu cuenta pasa al plan Gratis, sin perder tus datos.",
  },
  {
    q: "¿Qué pasa con mis datos?",
    a: "Son tuyos. No vendemos tus datos ni los de tus clientes; solo los usamos para que tu menú y tus pedidos funcionen.",
  },
] as const;

/** Lo que muestra cada tarjeta de precios. */
export type PlanCard = {
  id: PlanDefinition["id"];
  name: string;
  priceGtq: number;
  highlight: boolean;
  bullets: string[];
};

const limitText = (n: number | null, one: string, many: string) =>
  n === null ? `${many} ilimitados` : `${n} ${n === 1 ? one : many}`;

/** Tarjetas a partir del catálogo (los precios vienen de la base si se editaron). */
export function planCards(prices: Partial<Record<string, number>> = {}): PlanCard[] {
  return PLAN_CATALOG.map((p) => {
    const l = p.limits;
    const base = [
      p.id === "negocio"
        ? `${l.branches} sucursales incluidas`
        : limitText(l.branches, "sucursal", "sucursales"),
      limitText(l.products, "producto", "productos"),
      limitText(l.menus, "menú", "menús"),
      p.id === "gratis" ? "1 QR" : "QR ilimitados por mesa y campaña",
      "Pedidos por WhatsApp ilimitados",
    ];
    const extra =
      p.id === "gratis"
        ? ["Menú del día con 1 franja", "Visitas y pedidos del día"]
        : p.features
            .filter((f) =>
              [
                "scheduling",
                "preorders",
                "staff_pin",
                "analytics_full",
                "multi_branch",
                "remove_branding",
              ].includes(f),
            )
            .map((f) => FEATURE_LABELS[f]);
    return {
      id: p.id,
      name: p.name,
      priceGtq: prices[p.id] ?? p.price_gtq,
      highlight: p.id === "pro",
      bullets: [...base, ...extra],
    };
  });
}

/** Mensaje del botón de WhatsApp de ventas (guía: "Hola, quiero mi …"). */
export function salesWhatsappUrl(phoneDigits: string, brandName: string, text?: string) {
  const message = text ?? `Hola, quiero mi ${brandName}`;
  return `https://api.whatsapp.com/send?phone=${phoneDigits}&text=${encodeURIComponent(message)}`;
}
