import { expect, test } from "./support/test";
import { choose, interceptWhatsApp, passSplash, projectOf, query } from "./support/helpers";
import { e2eData } from "./support/run-data";

/**
 * C2 · A domicilio con ubicación, transferencia y email: link del negocio →
 * selector ordenado por cercanía → Zona 10 → carrito → A domicilio → "Usar mi
 * ubicación actual" (GPS simulado en la Zona 1) → dirección y referencia →
 * Transferencia con la cuenta → correo → WhatsApp con Google Maps y Waze.
 */
test("C2 · a domicilio con ubicación, transferencia y correo", async ({ page }, info) => {
  const data = e2eData();
  const email = `e2e-c2-${data.run}-${projectOf(info)}@qrmenu.test`;
  const whatsapp = await interceptWhatsApp(page);

  await page.goto(`/${data.slug}`);
  await expect(page.getByRole("heading", { name: "Elige tu sucursal" })).toBeVisible();
  await page.getByRole("button", { name: "Ordenar por cercanía" }).click();
  // Con la ubicación (Zona 1), la más cercana queda primero.
  const cards = page.getByRole("link", { name: /Zona 1|Zona 10|Nocturna/ });
  await expect(cards.first()).toContainText("Zona 1");
  await expect(cards.first()).toContainText("La más cercana");
  await page.getByRole("link", { name: /Zona 10/ }).click();

  await expect(page).toHaveURL(new RegExp(`/${data.slug}/zona-10`));
  await passSplash(page);
  await page.getByRole("button", { name: "Agregar Desayuno chapín" }).click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();

  const sheet = page.getByRole("dialog");
  await choose(sheet, "A domicilio");
  await sheet.getByRole("button", { name: "Usar mi ubicación actual" }).click();
  // Mapa con el pin y la distancia: dentro del radio, se suma el envío.
  await expect(sheet.locator(".leaflet-container")).toBeVisible();
  await expect(sheet.locator(".leaflet-marker-icon")).toBeVisible();
  await sheet.getByLabel("Dirección").fill("7a avenida 12-30, zona 1");
  await sheet.getByLabel("Punto de referencia").fill("Portón negro, frente a la farmacia");
  await expect(sheet.getByText("Envío: Q15.00")).toBeVisible();

  await choose(sheet, "Transferencia");
  await expect(sheet.getByText("000-000000-0")).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Copiar/ }).first()).toBeVisible();

  await sheet.getByLabel("Nombre").fill("Carlos E2E");
  await sheet.getByLabel("Teléfono").fill("55551234");
  await sheet.getByLabel("¿Quieres el resumen por correo?").fill(email);
  await sheet.getByRole("button", { name: /Pedir por WhatsApp/ }).click();

  await expect.poll(() => whatsapp.opened.length).toBe(1);
  const text = whatsapp.lastText();
  expect(text).toContain("Desayuno chapín");
  expect(text).toContain("7a avenida 12-30");
  expect(text).toMatch(/google\.com\/maps/);
  expect(text).toMatch(/waze\.com/);
  expect(whatsapp.opened[0]!.searchParams.get("phone")).toBe("50255550110");

  await page.goBack();
  await expect(page.getByRole("heading", { name: /¡Pedido #\d{4} recibido!/ })).toBeVisible();
  await expect(page.getByText("000-000000-0")).toBeVisible();

  const [order] = await query<{
    order_type: string;
    customer_email: string;
    delivery_fee_cents: number;
    delivery_lat: number | null;
    location_source: string;
    payment_method: string;
  }>(
    `SELECT order_type, customer_email, delivery_fee_cents, delivery_lat, location_source, payment_method
     FROM orders WHERE customer_email = $1`,
    [email],
  );
  expect(order).toMatchObject({
    order_type: "delivery",
    delivery_fee_cents: 1500,
    location_source: "gps",
    payment_method: "transfer",
  });
  expect(order!.delivery_lat).toBeCloseTo(14.6402, 3);
});
