/**
 * Aplica el SQL específico de Supabase (prisma/sql/*.sql) en orden, cada archivo
 * en su propia transacción. Los archivos son idempotentes: se puede correr
 * después de cada `prisma migrate deploy` sin efectos duplicados.
 *
 *   pnpm db:sql
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const SQL_DIR = join(process.cwd(), "prisma", "sql");

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("Falta DIRECT_URL (ver .env.example).");

  const files = readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(join(SQL_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("commit");
        console.log(`✓ ${file}`);
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Falló ${file}: ${(error as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
