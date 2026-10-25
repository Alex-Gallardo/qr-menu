import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Todo lo del E2E lleva este prefijo (negocios) o dominio (usuarios): así se limpia. */
export const E2E_SLUG_PREFIX = "zz-test-e2e-";
export const E2E_EMAIL_DOMAIN = "qrmenu.test";
/** Datos de la corrida (ignorado por git; se borra al terminar). */
export const RUN_FILE = join(process.cwd(), "tests", "e2e", ".data", "run.json");

export type E2EProject = "iphone" | "pixel";

export type E2EData = {
  run: string;
  slug: string;
  businessId: string;
  businessName: string;
  qrCode: string;
  staffPin: string;
  admin: { id: string; email: string; password: string; totpSecret: string };
  perProject: Record<
    E2EProject,
    { deviceToken: string; deliveryOrderNumber: number; paymentReference: string }
  >;
};

let cached: E2EData | null = null;

export function e2eData(): E2EData {
  cached ??= JSON.parse(readFileSync(RUN_FILE, "utf8")) as E2EData;
  return cached;
}
