import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import pg from "pg";
import type { E2EProject } from "./run-data";

/** Proyecto (dispositivo) que corre la prueba. */
export const projectOf = (info: TestInfo) => info.project.name as E2EProject;

/**
 * La bienvenida (panel con el logo que se levanta) aparece en la primera visita;
 * la prueba confirma que se ve y la toca para saltarla, como haría el comensal.
 */
export async function passSplash(page: Page) {
  const panel = page.locator("[data-splash-panel]");
  await expect(panel).toBeVisible();
  await panel.click();
  await expect(panel).toBeHidden();
}

/** Opción tipo píldora (radio oculto bajo su etiqueta): se toca el texto, como en el celular. */
export async function choose(scope: Locator | Page, name: string) {
  await scope.getByText(name, { exact: true }).click();
  await expect(scope.getByRole("radio", { name })).toBeChecked();
}

/**
 * WhatsApp no se abre de verdad: se responde con una página vacía y se guarda
 * la URL (con el texto del mensaje) para revisarla.
 */
export async function interceptWhatsApp(page: Page) {
  const opened: URL[] = [];
  await page
    .context()
    .route(/^https:\/\/(api|web)\.whatsapp\.com\/|^https:\/\/wa\.me\//, (route) => {
      opened.push(new URL(route.request().url()));
      return route.fulfill({ contentType: "text/html", body: "<title>WhatsApp</title>WhatsApp" });
    });
  return {
    opened,
    /** Texto del último mensaje abierto. */
    lastText: () => opened.at(-1)?.searchParams.get("text") ?? "",
  };
}

let pool: pg.Pool | null = null;

/** Consulta de solo lectura a la base para comprobar lo que guardó la app. */
export async function query<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const { rows } = await pool.query<T>(sql, params);
  return rows;
}

/** Una sola fila (la prueba falla si no hay). */
export async function queryOne<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  const [row] = await query<T>(sql, params);
  if (!row) throw new Error(`Sin resultados: ${sql}`);
  return row;
}
