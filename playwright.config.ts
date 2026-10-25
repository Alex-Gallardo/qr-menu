import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3101);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * E2E de los flujos críticos de la guía (QRM-045): C1, C2, C3, D1, S1, S2 y A2
 * en iPhone 13 (WebKit) y Pixel 7 (Chromium), con la ubicación simulada en la
 * Zona 1. Corren contra el build de producción (`pnpm build` antes) y la base
 * de .env.local, con un negocio propio `zz-test-e2e-*` que se crea y se borra.
 * No corren en CI: ahí no hay credenciales de la base.
 */
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/.results",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  // Un flujo a la vez: comparten el negocio de prueba y este equipo es lento.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "tests/e2e/.report", open: "never" }]],
  use: {
    baseURL,
    locale: "es-GT",
    timezoneId: "America/Guatemala",
    geolocation: { latitude: 14.6402, longitude: -90.5141, accuracy: 20 },
    permissions: ["geolocation"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
        // Sin correos reales: el pedido se guarda igual y la prueba revisa la base.
        env: { RESEND_API_KEY: "" },
      },
});
