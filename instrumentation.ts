import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

export function register() {
  // El paquete resuelve la versión correcta para el runtime (nodejs o edge).
  Sentry.init({ ...sentryOptions(), tracesSampleRate: 0.1 });
}

/** Reporta errores de Server Components, Route Handlers y Server Actions. */
export const onRequestError = Sentry.captureRequestError;
