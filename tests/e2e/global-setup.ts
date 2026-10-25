import { execFileSync } from "node:child_process";

/** Crea los datos de la corrida (negocio zz-test-e2e-*, admin con 2FA, pagos). */
export default function globalSetup() {
  runFixtures("setup");
}

export function runFixtures(command: "setup" | "teardown") {
  execFileSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--env-file=.env.local",
      "tests/e2e/fixtures/e2e-data.mts",
      command,
    ],
    { stdio: "inherit" },
  );
}
