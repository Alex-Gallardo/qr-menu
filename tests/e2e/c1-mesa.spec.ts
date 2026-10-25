import { expect, test } from "./support/test";
import { choose, interceptWhatsApp, passSplash, query, queryOne } from "./support/helpers";
import { e2eData } from "./support/run-data";

/**
 * C1 · Primer pedido desde el QR de una mesa: el QR cuenta el escaneo y abre la
 * sucursal con "Mesa 4"; "+" → Ver pedido (ya dice Comer aquí · Mesa 4) →
 * nombre y pago → Pedir por WhatsApp → mensaje listo → "Pedido #N recibido".
 */
test("C1 · pedido desde el QR de la mesa 4", async ({ page }) => {
  const data = e2eData();
  const whatsapp = await interceptWhatsApp(page);
  const { scans: scansBefore } = await queryOne<{ scans: number }>(
    "SELECT scans FROM qr_codes WHERE short_code = $1",
    [data.qrCode],
  );

  await page.goto(`/q/${data.qrCode}`);
  await expect(page).toHaveURL(new RegExp(`/${data.slug}/zona-1\\?.*mesa=4`));
  await passSplash(page);
  await expect(page.getByRole("heading", { name: data.businessName })).toBeVisible();

  await page.getByRole("button", { name: "Agregar Café de olla" }).click(); // toque 1
  await page.getByRole("button", { name: /Ver pedido/ }).click(); // toque 2

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("radio", { name: "Comer aquí" })).toBeChecked();
  await expect(sheet.getByLabel("Mesa")).toHaveValue("Mesa 4");
  await sheet.getByLabel("Nombre").fill("Ana E2E");
  await choose(sheet, "Efectivo"); // toque 3
  await sheet.getByRole("button", { name: /Pedir por WhatsApp/ }).click(); // toque 4

  await expect.poll(() => whatsapp.opened.length).toBe(1);
  const text = whatsapp.lastText();
  expect(text).toContain("Café de olla");
  expect(text).toContain("Mesa 4");
  expect(whatsapp.opened[0]!.searchParams.get("phone")).toBe("50255550101");

  // Regresa de WhatsApp: la confirmación ya está ahí.
  await page.goBack();
  await expect(page.getByRole("heading", { name: /¡Pedido #\d{4} recibido!/ })).toBeVisible();

  const { scans } = await queryOne<{ scans: number }>(
    "SELECT scans FROM qr_codes WHERE short_code = $1",
    [data.qrCode],
  );
  expect(scans).toBe(scansBefore + 1);
  const orders = await query<{ table_label: string; customer_name: string }>(
    `SELECT o.table_label, o.customer_name FROM orders o JOIN branches b ON b.id = o.branch_id
     WHERE b.business_id = $1 AND o.customer_name = 'Ana E2E' ORDER BY o.created_at DESC LIMIT 1`,
    [data.businessId],
  );
  expect(orders[0]).toMatchObject({ table_label: "Mesa 4" });
});
