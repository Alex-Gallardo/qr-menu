/**
 * Catálogo de planes (fuente para el seed y para getEntitlements en QRM-008).
 * En la base cada plan es editable desde el super admin; esto es el valor inicial.
 */

/** Funciones que una licencia puede activar o quitar. */
export const FEATURES = [
  "scheduling", // franjas desayuno/almuerzo/cena y programación semanal
  "branch_scheduling", // programación distinta por sucursal
  "multi_branch", // más de una sucursal
  "preorders", // pedidos fuera de horario
  "all_templates", // las 4 plantillas del menú
  "custom_palette", // paleta personalizada o extraída del logo
  "image_bg", // fondo con imagen
  "video_bg", // fondo con video
  "custom_splash", // bienvenida configurable
  "staff_pin", // staff con PIN
  "analytics_full", // analíticas completas
  "analytics_compare", // comparación por sucursal y exportar
  "remove_branding", // quitar "Hecho con …"
] as const;

export type Feature = (typeof FEATURES)[number];

/** Recursos con límite. null = ilimitado. */
export type PlanLimits = {
  branches: number | null;
  products: number | null;
  menus: number | null;
  time_slots: number | null;
  qr: number | null;
  managers: number | null;
  staff: number | null;
  storage_mb: number | null;
};

export type LimitedResource = keyof PlanLimits;

export type PlanDefinition = {
  id: "gratis" | "pro" | "negocio";
  name: string;
  price_gtq: number;
  limits: PlanLimits;
  features: Feature[];
  sort: number;
};

const PRO_FEATURES: Feature[] = [
  "scheduling",
  "preorders",
  "all_templates",
  "custom_palette",
  "image_bg",
  "video_bg",
  "custom_splash",
  "staff_pin",
  "analytics_full",
];

export const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    id: "gratis",
    name: "Gratis",
    price_gtq: 0,
    limits: {
      branches: 1,
      products: 25,
      menus: 1,
      time_slots: 1,
      qr: 1,
      managers: 0,
      staff: 0,
      storage_mb: 200,
    },
    features: [],
    sort: 0,
  },
  {
    id: "pro",
    name: "Pro",
    price_gtq: 149,
    limits: {
      branches: 1,
      products: null,
      menus: null,
      time_slots: null,
      qr: null,
      managers: 2,
      staff: null,
      storage_mb: 2000,
    },
    features: PRO_FEATURES,
    sort: 1,
  },
  {
    id: "negocio",
    name: "Negocio",
    price_gtq: 299,
    limits: {
      branches: 3,
      products: null,
      menus: null,
      time_slots: null,
      qr: null,
      managers: 10,
      staff: null,
      storage_mb: 5000,
    },
    features: [
      ...PRO_FEATURES,
      "branch_scheduling",
      "multi_branch",
      "analytics_compare",
      "remove_branding",
    ],
    sort: 2,
  },
];
