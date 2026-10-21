import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // En desarrollo Next imprime los argumentos de cada Server Action en la terminal
  // (incluidas contraseñas). Desactivado.
  logging: { serverFunctions: false },
  images: {
    // Fotos del bucket público "media" y las de ejemplo del seed.
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
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
