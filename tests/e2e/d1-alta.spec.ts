import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "./support/test";
import { projectOf, queryOne } from "./support/helpers";
import { logoPng } from "./support/png";
import { E2E_EMAIL_DOMAIN, E2E_SLUG_PREFIX, e2eData } from "./support/run-data";

/**
 * D1 · Alta y publicación: registro → asistente de 4 pasos (negocio y primera
 * sucursal con pin y WhatsApp; logo con paletas propuestas, plantilla y
 * bienvenida; productos de ejemplo; publicar) → menú en línea y PDF del QR.
 *
 * La cuenta se confirma con el mismo enlace que llevaría el correo (generado
 * con la API de administración): así no se envían correos a direcciones falsas.
 */
test("D1 · alta y publicación del menú", async ({ page }, info) => {
  const data = e2eData();
  const project = projectOf(info);
  const email = `e2e-d1-${data.run}-${project}@${E2E_EMAIL_DOMAIN}`;
  const slug = `${E2E_SLUG_PREFIX}d1-${data.run}-${project}`;
  const started = Date.now();

  // Registro: el formulario existe con los datos de la guía.
  await page.goto("/registro");
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const link = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: randomBytes(18).toString("base64url"),
    options: { data: { full_name: "Dueña E2E" } },
  });
  expect(link.error).toBeNull();
  await page.goto(
    `/auth/callback?token_hash=${link.data.properties!.hashed_token}&type=signup&next=/onboarding`,
  );
  await expect(page).toHaveURL(/\/onboarding/);

  // Paso 1: negocio, link y primera sucursal.
  await page.getByLabel("Nombre del negocio").fill(`Comedor E2E ${project}`);
  await page.getByLabel("Link de tu menú").fill(slug);
  await page.getByLabel("Nombre de la sucursal").fill("Centro");
  await page.getByLabel("Dirección").fill("5a avenida 3-10, zona 1");
  await page.getByLabel("Ciudad").fill("Ciudad de Guatemala");
  await page.getByRole("button", { name: "Usar mi ubicación" }).click();
  await expect(page.locator(".leaflet-marker-icon")).toBeVisible();
  await page.getByLabel("WhatsApp que recibe los pedidos").fill("5555 1234");
  await expect(page.getByRole("link", { name: "Enviar mensaje de prueba" })).toHaveAttribute(
    "href",
    /50255551234/,
  );
  await page.getByRole("button", { name: "Siguiente: tu marca" }).click();

  // Paso 2: logo → paletas propuestas, plantilla y bienvenida con "Reproducir".
  await expect(page).toHaveURL(/paso=2/);
  await page.locator('input[type="file"]').setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: logoPng(),
  });
  await page.getByRole("button", { name: "Usar esta foto" }).click();
  const proposals = page.getByRole("radiogroup", { name: "Paletas de tu logo" });
  await expect(proposals).toBeVisible({ timeout: 30_000 });
  await proposals.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Reproducir" }).click();
  await page.getByRole("button", { name: "Siguiente: tus productos" }).click();

  // Paso 3: productos de ejemplo.
  await expect(page).toHaveURL(/paso=3/);
  await page.getByRole("button", { name: "Usar ejemplos" }).click();
  await page.getByRole("button", { name: "Siguiente: publicar" }).click();

  // Paso 4: publicar → en línea → PDF del QR.
  await expect(page.getByRole("heading", { name: "Todo listo para publicar" })).toBeVisible();
  await page.getByRole("button", { name: "Publicar mi menú" }).click();
  await expect(page.getByRole("heading", { name: "¡Tu menú está en línea!" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`/${slug}`) })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar QR para imprimir (PDF)" }).click();
  const pdf = readFileSync(await (await download).path());
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  const business = await queryOne<{ published: boolean; products: number; qrs: number }>(
    `SELECT b.published,
       (SELECT count(*)::int FROM products p WHERE p.business_id = b.id) AS products,
       (SELECT count(*)::int FROM qr_codes q WHERE q.business_id = b.id) AS qrs
     FROM businesses b WHERE b.slug = $1`,
    [slug],
  );
  expect(business).toMatchObject({ published: true, qrs: 1 });
  expect(business.products).toBeGreaterThanOrEqual(5);
  // Objetivo de la guía: menos de 10 minutos (aquí, sin pensar, mucho menos).
  expect(Date.now() - started).toBeLessThan(10 * 60_000);
});
