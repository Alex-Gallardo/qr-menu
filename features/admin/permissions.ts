/**
 * Permisos del equipo de la plataforma (guía §9 "Roles y permisos"). Viven en
 * código; se exigen con requirePlatform(permiso) en páginas y acciones.
 */

export type PlatformRole = "admin" | "support" | "sales";

export const PERMISSIONS = {
  /** Ver negocios, licencias y uso. */
  "businesses.view": ["admin", "support", "sales"],
  /** Crear negocio o demo (alta asistida). */
  "businesses.create": ["admin", "sales"],
  /** Cambiar plan, límites y funciones. */
  "licenses.edit": ["admin"],
  /** Extender vigencia o dar precio especial. */
  "licenses.extend": ["admin"],
  /** Verificar o rechazar pagos (y registrar uno manual). */
  "payments.verify": ["admin"],
  /** Suspender, reactivar o cancelar. */
  "licenses.status": ["admin"],
  /** Entrar como el negocio en solo lectura. */
  "businesses.impersonate": ["admin", "support"],
  /** Enlace de acceso al dueño, cerrar sesiones de staff. */
  "support.access": ["admin", "support"],
  /** Planes, precios, configuración global y anuncios. */
  "settings.edit": ["admin"],
  /** Ver la auditoría. */
  "audit.view": ["admin", "support"],
} as const satisfies Record<string, readonly PlatformRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: string | null | undefined, permission: Permission) {
  return (PERMISSIONS[permission] as readonly string[]).includes(role ?? "");
}

export const ROLE_LABELS: Record<PlatformRole, string> = {
  admin: "Admin",
  support: "Soporte",
  sales: "Ventas",
};

/** Secciones del super admin y el permiso para verlas. */
export const ADMIN_NAV = [
  { href: "/admin", label: "Tablero", permission: "businesses.view" },
  { href: "/admin/negocios", label: "Negocios", permission: "businesses.view" },
  { href: "/admin/pagos", label: "Pagos", permission: "payments.verify" },
  { href: "/admin/anuncios", label: "Anuncios", permission: "settings.edit" },
  { href: "/admin/configuracion", label: "Configuración", permission: "settings.edit" },
  { href: "/admin/auditoria", label: "Auditoría", permission: "audit.view" },
] as const satisfies readonly { href: string; label: string; permission: Permission }[];
