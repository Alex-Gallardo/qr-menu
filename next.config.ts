import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Solo con token se suben source maps (en Vercel). Sin token el build sigue normal.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Ruta propia para que los bloqueadores de anuncios no descarten los errores.
  // Vive bajo /api, que es un slug reservado; el proxy de QRM-007 debe dejarla pasar.
  tunnelRoute: "/api/monitoring",
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
  telemetry: false,
  // Sin tracing en el navegador (se carga diferido), así que no se instrumentan navegaciones.
  suppressOnRouterTransitionStartWarning: true,
});
