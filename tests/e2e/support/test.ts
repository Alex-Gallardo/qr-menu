import { test as base } from "@playwright/test";
import { e2eData } from "./run-data";

/**
 * `test` del E2E: cada página empieza con un id de sesión de pedidos
 * `e2e-…` (localStorage "qrm:sesion"), así el teardown borra sus límites.
 */
export const test = base.extend({
  page: async ({ page }, provide, info) => {
    const id = `e2e-${e2eData().run}-${info.project.name}-${info.workerIndex}-${Date.now().toString(36)}`;
    await page.addInitScript((value) => {
      try {
        if (!localStorage.getItem("qrm:sesion")) localStorage.setItem("qrm:sesion", value);
      } catch {
        // Sin almacenamiento: la app usa uno nuevo por visita.
      }
    }, id);
    await provide(page);
  },
});

export { expect } from "@playwright/test";
