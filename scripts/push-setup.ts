/**
 * Configuración de los avisos push (QRM-032).
 *
 *   pnpm push:keys            → genera llaves VAPID y CRON_SECRET (las imprime)
 *   pnpm push:keys --write    → y las agrega a .env.local si faltan
 *   pnpm push:cron https://tu-dominio/api/cron/push   → programa el cron cada minuto
 *   pnpm push:cron --status   → estado del cron y últimas respuestas
 *   pnpm push:cron --off      → lo apaga
 *
 * El cron corre en la base (pg_cron + pg_net de Supabase, gratis y cada
 * minuto): Vercel Hobby solo permite crons diarios. La URL y CRON_SECRET se
 * guardan cifrados en Supabase Vault, nunca en el repositorio.
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";
import { generateVapidKeys } from "../lib/push/web-push";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const JOB = "qrm-push-reminders";
const URL_SECRET = "qrm_cron_push_url";
const TOKEN_SECRET = "qrm_cron_secret";

function keys(write: boolean) {
  const vapid = generateVapidKeys();
  const lines = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
    CRON_SECRET: randomBytes(32).toString("base64url"),
  };
  if (!write) {
    for (const [k, v] of Object.entries(lines)) console.log(`${k}=${v}`);
    return;
  }
  const current = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  const missing = Object.entries(lines).filter(([k]) => !new RegExp(`^${k}=.+`, "m").test(current));
  if (missing.length === 0) {
    console.log("✓ .env.local ya tiene las llaves de push (no se cambiaron).");
    return;
  }
  appendFileSync(
    ".env.local",
    `\n# ── Avisos push (pnpm push:keys) ──\n${missing.map(([k, v]) => `${k}=${v}`).join("\n")}\n`,
  );
  console.log(`✓ Agregadas a .env.local: ${missing.map(([k]) => k).join(", ")}`);
}

async function withDb<T>(fn: (c: Client) => Promise<T>) {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("Falta DIRECT_URL (ver .env.example).");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function upsertSecret(c: Client, name: string, value: string) {
  const { rows } = await c.query<{ id: string }>("select id from vault.secrets where name = $1", [
    name,
  ]);
  if (rows[0]) await c.query("select vault.update_secret($1, $2)", [rows[0].id, value]);
  else await c.query("select vault.create_secret($1, $2)", [value, name]);
}

async function schedule(url: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) throw new Error("Falta CRON_SECRET en .env.local.");
  if (!/^https:\/\/[^/]+\/api\/cron\/push$/.test(url))
    throw new Error("La URL debe ser https://<dominio>/api/cron/push");
  await withDb(async (c) => {
    await c.query("create extension if not exists pg_cron");
    await c.query("create extension if not exists pg_net");
    await upsertSecret(c, URL_SECRET, url);
    await upsertSecret(c, TOKEN_SECRET, secret);
    await c.query("select cron.schedule($1, '* * * * *', $2)", [
      JOB,
      `select net.http_get(
        url := (select decrypted_secret from vault.decrypted_secrets where name = '${URL_SECRET}'),
        headers := jsonb_build_object('Authorization', 'Bearer ' ||
          (select decrypted_secret from vault.decrypted_secrets where name = '${TOKEN_SECRET}')),
        timeout_milliseconds := 25000
      )`,
    ]);
  });
  console.log(`✓ Cron "${JOB}" cada minuto → ${url}`);
  console.log("  CRON_SECRET debe ser el mismo en Vercel. Revisa con: pnpm push:cron --status");
}

async function off() {
  await withDb(async (c) => {
    const { rows } = await c.query("select 1 from pg_extension where extname = 'pg_cron'");
    if (rows.length > 0)
      await c.query("select cron.unschedule(jobid) from cron.job where jobname = $1", [JOB]);
  });
  console.log(`✓ Cron "${JOB}" apagado.`);
}

async function status() {
  await withDb(async (c) => {
    const ext = await c.query(
      "select extname from pg_extension where extname in ('pg_cron','pg_net')",
    );
    console.log("Extensiones:", ext.rows.map((r) => r.extname).join(", ") || "ninguna");
    if (!ext.rows.some((r) => r.extname === "pg_cron")) return;
    const job = await c.query("select jobid, schedule, active from cron.job where jobname = $1", [
      JOB,
    ]);
    console.log("Cron:", job.rows[0] ?? "no programado");
    if (!job.rows[0]) return;
    const runs = await c.query(
      `select status, start_time from cron.job_run_details where jobid = $1
       order by start_time desc limit 5`,
      [job.rows[0].jobid],
    );
    console.table(runs.rows);
    if (ext.rows.some((r) => r.extname === "pg_net")) {
      const responses = await c.query(
        `select status_code, left(content, 120) as content, created from net._http_response
         order by created desc limit 5`,
      );
      console.table(responses.rows);
    }
  });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "keys") return keys(args.includes("--write"));
  if (command === "cron" && args[0] === "--off") return off();
  if (command === "cron" && args[0] === "--status") return status();
  if (command === "cron" && args[0]) return schedule(args[0]);
  console.log(readFileSync(__filename, "utf8").split("*/")[0]);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
