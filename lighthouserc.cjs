/**
 * Lighthouse CI (QRM-045). Móvil (el preset por defecto de Lighthouse) contra el
 * build de producción. Accesibilidad, buenas prácticas y SEO fallan bajo 90.
 * Rendimiento solo avisa: en un servidor local o un runner de CI los scripts
 * se ejecutan antes de la primera pintura y el LCP simulado sale ~80 aunque en
 * producción (CDN) dé ≥ 95; la medición que cuenta es la de PageSpeed en el
 * dominio real (docs/verificacion.md §4, QRM-043/045).
 *
 * En CI se revisan la landing, precios y legal (no necesitan base). En local,
 * con LHCI_MENU=1, también el menú del demo; /api/ev y Sentry se bloquean para
 * no sumar visitas al demo.
 */
const PORT = 3102;
const base = `http://localhost:${PORT}`;
const pages = ["/", "/precios", "/legal/privacidad"];
if (process.env.LHCI_MENU) pages.push("/cafe-el-portal/zona-1");

module.exports = {
  ci: {
    collect: {
      startServerCommand: `pnpm start -p ${PORT}`,
      startServerReadyPattern: "Ready",
      startServerReadyTimeout: 120000,
      url: pages.map((p) => `${base}${p}`),
      numberOfRuns: Number(process.env.LHCI_RUNS ?? 3),
      settings: {
        chromeFlags: "--no-sandbox",
        blockedUrlPatterns: ["*/api/ev*", "*/api/monitoring*"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci/reports" },
  },
};
