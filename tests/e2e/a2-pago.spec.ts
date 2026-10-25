import { expect, test } from "./support/test";
import { projectOf, query, queryOne } from "./support/helpers";
import { e2eData } from "./support/run-data";
import { serverClockOffset, totp } from "./support/totp";

/**
 * A2 · Verificar un pago: el admin de plataforma entra con contraseña y 2FA,
 * va a Pagos ("Por verificar"), encuentra la boleta por su referencia y
 * la verifica: la licencia se extiende y el pago queda verificado.
 */
test("A2 · el admin verifica un pago con 2FA", async ({ page }, info) => {
  const data = e2eData();
  const reference = data.perProject[projectOf(info)].paymentReference;
  const { ends_at: endsBefore } = await queryOne<{ ends_at: Date }>(
    "SELECT ends_at FROM licenses WHERE business_id = $1",
    [data.businessId],
  );

  await page.goto("/entrar?next=/admin");
  await page.getByRole("tab", { name: "Con contraseña" }).click();
  await page.getByLabel("Correo").fill(data.admin.email);
  await page.getByLabel("Contraseña").fill(data.admin.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  // /admin exige 2FA en esta sesión (aal2): la app pide el código de 6 dígitos.
  await expect(page).toHaveURL(/\/entrar\/2fa/);
  const offset = await serverClockOffset(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  await page.getByLabel("Código").fill(totp(data.admin.totpSecret, Date.now() + offset));
  await page.getByRole("button", { name: "Verificar" }).click();

  // Ya con 2FA entra al tablero; de ahí a Pagos ("Por verificar").
  await expect(page.getByRole("heading", { name: "Tablero" })).toBeVisible();
  await page.getByRole("link", { name: "Pagos", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/pagos/);
  await expect(page.getByRole("link", { name: "Por verificar" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const card = page.getByRole("listitem").filter({ hasText: `ref. ${reference}` });
  await expect(card).toContainText(data.businessName);
  await expect(card).toContainText("Q299.00");
  await card.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByText(/Verificado: activa hasta el/)).toBeVisible();

  const [payment] = await query<{ status: string; verified_by: string }>(
    "SELECT status, verified_by FROM payments WHERE reference = $1",
    [reference],
  );
  expect(payment).toMatchObject({ status: "verified", verified_by: data.admin.id });
  const { ends_at } = await queryOne<{ ends_at: Date }>(
    "SELECT ends_at FROM licenses WHERE business_id = $1",
    [data.businessId],
  );
  expect(ends_at.getTime()).toBeGreaterThan(endsBefore.getTime());
});
