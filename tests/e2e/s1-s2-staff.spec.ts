import { expect, test } from "./support/test";
import { projectOf, query } from "./support/helpers";
import { e2eData } from "./support/run-data";

const orderLabel = (n: number) => `#${String(n).padStart(4, "0")}`;

/**
 * S1 · Iniciar turno con PIN y S2 · Atender un pedido a domicilio, en la tablet
 * autorizada de la Zona 1 (la cookie del dispositivo la deja el setup, como
 * después de "Autorizar este dispositivo"). El aviso push no se prueba aquí.
 */
test("S1 + S2 · turno con PIN y pedido a domicilio hasta entregado", async ({
  page,
  baseURL,
}, info) => {
  const data = e2eData();
  const mine = data.perProject[projectOf(info)];
  await page
    .context()
    .addCookies([
      { name: "qrm_staff_device", value: mine.deviceToken, url: baseURL!, httpOnly: true },
    ]);

  // S1: teclado con el nombre del negocio → PIN → bandeja de su sucursal.
  await page.goto("/staff");
  await expect(page.getByRole("heading", { name: data.businessName })).toBeVisible();
  await expect(page.getByText("Zona 1 · Tablet E2E")).toBeVisible();
  for (const digit of data.staffPin)
    await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/staff\/pedidos/);

  // S2: el pedido a domicilio → detalle con mapa → Aceptar … Entregado.
  const label = orderLabel(mine.deliveryOrderNumber);
  await page.getByRole("link", { name: label, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Entrega" })).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir en Waze" })).toHaveAttribute(
    "href",
    /waze\.com/,
  );
  await expect(page.getByRole("button", { name: "Copiar coordenadas" })).toBeVisible();

  for (const step of ["Aceptar", "Empezar a preparar", "Listo para enviar", "Entregado"]) {
    await page.getByRole("button", { name: step, exact: true }).click();
    await expect(page.getByRole("button", { name: step, exact: true })).toHaveCount(0);
  }

  await expect
    .poll(async () => {
      const [row] = await query<{ status: string }>(
        `SELECT o.status FROM orders o JOIN branches b ON b.id = o.branch_id
         WHERE b.business_id = $1 AND o.number = $2 AND b.slug = 'zona-1'`,
        [data.businessId, mine.deliveryOrderNumber],
      );
      return row?.status;
    })
    .toBe("delivered");
});
