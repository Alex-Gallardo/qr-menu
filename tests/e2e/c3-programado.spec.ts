import { expect, test } from "./support/test";
import { interceptWhatsApp, passSplash, projectOf, query } from "./support/helpers";
import { e2eData } from "./support/run-data";

/**
 * C3 · Pedido programado fuera de horario: la sucursal "Nocturna" está cerrada
 * ahora (abre en ~2 h, modo "Para cuando abra"). Se ve el aviso, "¿Para cuándo?"
 * solo ofrece horas de cuando abre y el mensaje dice "Programado para …".
 */
test("C3 · pedido programado con la sucursal cerrada", async ({ page }, info) => {
  const data = e2eData();
  const name = `Lucía E2E ${projectOf(info)}`;
  const whatsapp = await interceptWhatsApp(page);

  await page.goto(`/${data.slug}/nocturna`);
  await passSplash(page);
  await expect(
    page.getByText(/Ahorita estamos cerrados, pero puedes dejar tu pedido/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Agregar Café de olla" }).click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();

  const sheet = page.getByRole("dialog");
  const when = sheet.getByRole("group", { name: "¿Para cuándo?" });
  // Cerrada: no hay "Lo antes posible", solo día y hora.
  await expect(when.getByText("Lo antes posible")).toHaveCount(0);
  const hour = when.getByLabel("Hora");
  const options = await hour.locator("option").allTextContents();
  expect(options.length).toBeGreaterThan(1);
  await hour.selectOption({ label: options[1]! });

  await sheet.getByText("Para llevar", { exact: true }).click();
  await sheet.getByLabel("Nombre").fill(name);
  await sheet.getByText("Efectivo", { exact: true }).click();
  await sheet.getByRole("button", { name: /Pedir por WhatsApp/ }).click();

  await expect.poll(() => whatsapp.opened.length).toBe(1);
  expect(whatsapp.lastText()).toContain("Programado para");
  expect(whatsapp.lastText()).toContain(options[1]!);

  const [order] = await query<{ scheduled_for: Date | null }>(
    "SELECT scheduled_for FROM orders WHERE customer_name = $1",
    [name],
  );
  expect(order!.scheduled_for).not.toBeNull();
  expect(order!.scheduled_for!.getTime()).toBeGreaterThan(Date.now());
});
