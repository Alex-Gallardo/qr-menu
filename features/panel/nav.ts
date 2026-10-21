import type { MemberRole } from "@/lib/auth/access";

/**
 * Navegación del panel. En móvil: 4 pestañas (Pedidos, Menú, Inicio, Más);
 * en escritorio: barra lateral por grupos. Lo marcado ownerOnly no lo ve el
 * encargado (y la página también lo valida en el servidor).
 */

export type NavIcon =
  | "home"
  | "orders"
  | "products"
  | "menus"
  | "schedule"
  | "branches"
  | "appearance"
  | "qr"
  | "reviews"
  | "analytics"
  | "team"
  | "business"
  | "payments"
  | "notifications"
  | "license"
  | "more";

export type NavItem = {
  /** Segmento relativo a /panel/{businessId}; "" = Inicio. */
  segment: string;
  label: string;
  icon: NavIcon;
  ownerOnly?: boolean;
};

export type NavGroup = { label: string | null; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { segment: "", label: "Inicio", icon: "home" },
      { segment: "pedidos", label: "Pedidos", icon: "orders" },
    ],
  },
  {
    label: "Menú",
    items: [
      { segment: "productos", label: "Productos", icon: "products" },
      { segment: "menus", label: "Menús", icon: "menus" },
      { segment: "programacion", label: "Programación", icon: "schedule" },
    ],
  },
  {
    label: "Negocio",
    items: [
      { segment: "sucursales", label: "Sucursales", icon: "branches" },
      { segment: "apariencia", label: "Apariencia", icon: "appearance", ownerOnly: true },
      { segment: "qr", label: "QR y compartir", icon: "qr" },
      { segment: "resenas", label: "Reseñas", icon: "reviews" },
      { segment: "analiticas", label: "Analíticas", icon: "analytics" },
      { segment: "equipo", label: "Equipo", icon: "team" },
    ],
  },
  {
    label: "Ajustes",
    items: [
      { segment: "ajustes/negocio", label: "Negocio", icon: "business", ownerOnly: true },
      {
        segment: "ajustes/pagos",
        label: "Pagos",
        icon: "payments",
        ownerOnly: true,
      },
      { segment: "ajustes/notificaciones", label: "Notificaciones", icon: "notifications" },
      { segment: "ajustes/licencia", label: "Mi plan", icon: "license", ownerOnly: true },
    ],
  },
];

/** Pestañas inferiores en móvil (la guía: Pedidos, Menú, Inicio, Más). */
export const MOBILE_TABS: NavItem[] = [
  { segment: "pedidos", label: "Pedidos", icon: "orders" },
  { segment: "productos", label: "Menú", icon: "products" },
  { segment: "", label: "Inicio", icon: "home" },
  { segment: "mas", label: "Más", icon: "more" },
];

export function navForRole(role: MemberRole): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => role === "owner" || !i.ownerOnly),
  })).filter((g) => g.items.length > 0);
}

export function isOwnerOnly(segment: string) {
  return NAV_GROUPS.some((g) => g.items.some((i) => i.segment === segment && i.ownerOnly));
}

export function panelHref(businessId: string, segment: string) {
  return segment ? `/panel/${businessId}/${segment}` : `/panel/${businessId}`;
}

/**
 * ¿Está activo el ítem para la ruta actual? Inicio solo en coincidencia exacta;
 * el resto también en sus subrutas (/pedidos/123). "Más" agrupa lo que no es pestaña.
 */
export function isActive(pathname: string, businessId: string, segment: string) {
  const base = panelHref(businessId, "");
  if (segment === "") return pathname === base;
  if (segment === "mas") {
    const tabSegments = MOBILE_TABS.map((t) => t.segment).filter((s) => s && s !== "mas");
    const rest = pathname.slice(base.length + 1);
    return rest !== "" && !tabSegments.some((s) => rest === s || rest.startsWith(`${s}/`));
  }
  const href = panelHref(businessId, segment);
  return pathname === href || pathname.startsWith(`${href}/`);
}
