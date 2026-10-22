/**
 * Reglas de acceso del proxy, como función pura para poder probarlas sin servidor.
 * El proxy solo decide a dónde va la petición; los permisos finos (rol, sucursal,
 * licencia, 2FA) se validan en el servidor con requireAccess / requirePlatform.
 */

export const STAFF_DEVICE_COOKIE = "qrm_staff_device";

/** Requieren usuario con email (no anónimo). */
const PROTECTED_PREFIXES = ["/panel", "/onboarding", "/admin"];
/** Siguen funcionando durante el mantenimiento. */
const MAINTENANCE_ALLOWED = ["/admin", "/entrar", "/auth", "/recuperar", "/mantenimiento", "/api"];
/** Si ya hay sesión, no tiene sentido mostrarlas. */
const GUEST_ONLY = ["/entrar", "/registro"];

export type RouteContext = {
  pathname: string;
  search: string;
  /** Usuario con email (dueño, encargado o equipo de la plataforma). */
  isUser: boolean;
  /** Sesión anónima de un dispositivo de staff. */
  isStaffSession: boolean;
  hasStaffDevice: boolean;
  maintenance: boolean;
  /**
   * POST de una Server Action. Nunca se redirige: un 307 a /entrar le llega al
   * cliente como "An unexpected response was received from the server". La
   * acción valida la sesión con requireAccess y responde con un mensaje claro.
   */
  isServerAction: boolean;
};

export type RouteDecision =
  { type: "next" } | { type: "redirect"; to: string } | { type: "maintenance" };

export function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Acepta solo rutas internas: evita redirecciones abiertas a otros dominios. */
export function safeNext(next: string | null | undefined, fallback = "/panel"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

export function loginUrl(pathname: string, search = "") {
  return `/entrar?next=${encodeURIComponent(pathname + search)}`;
}

export function decideRoute(ctx: RouteContext): RouteDecision {
  const { pathname } = ctx;

  if (ctx.maintenance && !matchesPrefix(pathname, MAINTENANCE_ALLOWED)) {
    return { type: "maintenance" };
  }

  if (ctx.isServerAction) return { type: "next" };

  if (matchesPrefix(pathname, PROTECTED_PREFIXES) && !ctx.isUser) {
    return { type: "redirect", to: loginUrl(pathname, ctx.search) };
  }

  // /staff: dispositivo autorizado (cookie), turno con PIN o un dueño/encargado
  // que viene a autorizar este dispositivo.
  if (
    matchesPrefix(pathname, ["/staff"]) &&
    !ctx.isUser &&
    !ctx.isStaffSession &&
    !ctx.hasStaffDevice
  ) {
    return { type: "redirect", to: loginUrl(pathname, ctx.search) };
  }

  if (GUEST_ONLY.includes(pathname) && ctx.isUser) {
    const next = new URLSearchParams(ctx.search).get("next");
    return { type: "redirect", to: safeNext(next) };
  }

  return { type: "next" };
}
