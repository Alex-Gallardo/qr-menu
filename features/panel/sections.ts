import type { NavIcon } from "./nav";

/** Textos de las secciones que todavía no tienen su pantalla (se completan ticket a ticket). */
export const SECTIONS: Record<
  string,
  { title: string; description: string; empty: string; icon: NavIcon; ticket: string }
> = {
  pedidos: {
    title: "Pedidos",
    description: "Los pedidos de tus sucursales en tiempo real.",
    empty: "Aquí vas a ver y atender cada pedido apenas llegue, con sonido y aviso.",
    icon: "orders",
    ticket: "QRM-030",
  },
  productos: {
    title: "Productos",
    description: "Tu catálogo, con disponibilidad y precio por sucursal.",
    empty: "Agrega tus platillos y bebidas una vez y úsalos en todos tus menús.",
    icon: "products",
    ticket: "QRM-014",
  },
  menus: {
    title: "Menús",
    description: "Arma tus menús por secciones.",
    empty: "Crea tu menú de desayunos, almuerzo o carta con los productos de tu catálogo.",
    icon: "menus",
    ticket: "QRM-017",
  },
  programacion: {
    title: "Programación",
    description: "Qué menú se ve en cada franja y cada día.",
    empty: "Programa tu semana una vez y el menú cambia solo según la hora.",
    icon: "schedule",
    ticket: "QRM-018",
  },
  sucursales: {
    title: "Sucursales",
    description: "Tus locales: dirección, WhatsApp, horarios y entregas.",
    empty: "Configura cada local con su WhatsApp, su horario y su zona de entrega.",
    icon: "branches",
    ticket: "QRM-012",
  },
  apariencia: {
    title: "Apariencia",
    description: "Colores, fuentes, fondo y bienvenida de tu menú.",
    empty: "Dale a tu menú los colores de tu marca y elige cómo da la bienvenida.",
    icon: "appearance",
    ticket: "QRM-033",
  },
  qr: {
    title: "QR y compartir",
    description: "Códigos QR por sucursal y mesa, y textos listos para redes.",
    empty: "Genera el QR de cada mesa y descárgalo listo para imprimir.",
    icon: "qr",
    ticket: "QRM-035",
  },
  resenas: {
    title: "Reseñas",
    description: "Lo que opinan tus clientes de cada sucursal.",
    empty: "Después de cada pedido tus clientes pueden calificarte y publicar en Google.",
    icon: "reviews",
    ticket: "QRM-037",
  },
  analiticas: {
    title: "Analíticas",
    description: "Visitas, pedidos y productos más vendidos.",
    empty: "Mira cuántas personas ven tu menú y cuántas piden, por sucursal.",
    icon: "analytics",
    ticket: "QRM-038",
  },
  equipo: {
    title: "Equipo",
    description: "Encargados, staff con PIN y dispositivos autorizados.",
    empty: "Invita a tus encargados y crea el PIN de tu equipo para la tablet de caja.",
    icon: "team",
    ticket: "QRM-040",
  },
  "ajustes/negocio": {
    title: "Datos del negocio",
    description: "Nombre, link, descripción y redes.",
    empty: "Aquí cambias el nombre y el link de tu negocio.",
    icon: "business",
    ticket: "QRM-011",
  },
  "ajustes/pagos": {
    title: "Cuentas para transferencia",
    description: "Las cuentas que ven tus clientes cuando eligen pagar por transferencia.",
    empty: "Agrega tus cuentas bancarias para que tus clientes te transfieran fácil.",
    icon: "payments",
    ticket: "QRM-012",
  },
  "ajustes/notificaciones": {
    title: "Notificaciones",
    description: "Avisos de pedidos en este dispositivo.",
    empty: "Activa los avisos para que suene cada pedido nuevo, aunque tengas la app cerrada.",
    icon: "notifications",
    ticket: "QRM-032",
  },
  "ajustes/licencia": {
    title: "Mi plan",
    description: "Tu plan, lo que usas y cómo pagar.",
    empty: "Aquí verás tu plan, tus límites y podrás subir tu comprobante de pago.",
    icon: "license",
    ticket: "QRM-041",
  },
};
