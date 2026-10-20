/**
 * Opciones comunes de Sentry. Sentry solo se activa en builds de producción con
 * DSN; sin DSN la app funciona igual y el SDK del navegador ni se descarga.
 * Privacidad: no se envían IPs, cookies ni datos del comensal (sendDefaultPii: false).
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function sentryOptions() {
  return {
    dsn: SENTRY_DSN,
    enabled: Boolean(SENTRY_DSN) && process.env.NODE_ENV === "production",
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
  };
}

/**
 * Carga el SDK del navegador bajo demanda para no sumar ~60 KB gzip al JS
 * inicial del menú público (presupuesto < 130 KB).
 */
export function loadBrowserSentry() {
  if (!sentryOptions().enabled) return Promise.resolve(null);
  return import("./sentry-browser");
}
