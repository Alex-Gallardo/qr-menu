import { runFixtures } from "./global-setup";

/** Borra todo lo del E2E: negocios zz-test-e2e-*, usuarios e2e-* y sus límites. */
export default function globalTeardown() {
  if (process.env.E2E_KEEP_DATA) return;
  runFixtures("teardown");
}
