/**
 * Verifica que la base cumpla el contrato del esquema: 38 tablas, RLS en todas,
 * políticas, funciones, triggers de auth, bucket de Storage y Realtime.
 *
 *   pnpm db:verify
 */
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const EXPECTED_TABLES = 39;

type Check = { name: string; sql: string; ok: (rows: Record<string, unknown>[]) => boolean };

const checks: Check[] = [
  {
    name: `${EXPECTED_TABLES} tablas de la app en public`,
    sql: `select count(*)::int as n from pg_tables
          where schemaname = 'public' and tablename <> '_prisma_migrations'`,
    ok: (r) => r[0]?.n === EXPECTED_TABLES,
  },
  {
    name: "RLS activo en todas las tablas de public",
    sql: `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`,
    ok: (r) => r.length === 0,
  },
  {
    name: "Políticas de pedidos (orders, order_status_events)",
    sql: `select count(*)::int as n from pg_policies
          where schemaname = 'public' and tablename in ('orders', 'order_status_events')`,
    ok: (r) => r[0]?.n === 2,
  },
  {
    name: "Funciones can_see_branch, is_member, is_platform",
    sql: `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname in ('can_see_branch', 'is_member', 'is_platform')`,
    ok: (r) => r[0]?.n === 3,
  },
  {
    name: "Triggers de perfil en auth.users",
    sql: `select count(*)::int as n from pg_trigger
          where tgrelid = 'auth.users'::regclass
            and tgname in ('on_auth_user_created', 'on_auth_user_deleted')`,
    ok: (r) => r[0]?.n === 2,
  },
  {
    name: "Índice one_default_menu y CHECK rating_range",
    sql: `select (select count(*) from pg_indexes where indexname = 'one_default_menu')::int
               + (select count(*) from pg_constraint where conname = 'rating_range')::int as n`,
    ok: (r) => r[0]?.n === 2,
  },
  {
    name: "Bucket media público",
    sql: `select public from storage.buckets where id = 'media'`,
    ok: (r) => r[0]?.public === true,
  },
  {
    name: "Bucket receipts privado (boletas)",
    sql: `select public from storage.buckets where id = 'receipts'`,
    ok: (r) => r[0]?.public === false,
  },
  {
    name: "Políticas de Storage para media",
    sql: `select count(*)::int as n from pg_policies
          where schemaname = 'storage' and tablename = 'objects' and policyname like 'miembros %'`,
    ok: (r) => r[0]?.n === 3,
  },
  {
    name: "orders publicado en Realtime",
    sql: `select count(*)::int as n from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'`,
    ok: (r) => r[0]?.n === 1,
  },
];

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("Falta DIRECT_URL (ver .env.example).");

  const client = new Client({ connectionString: url });
  await client.connect();
  let failed = 0;
  try {
    for (const check of checks) {
      const { rows } = await client.query(check.sql);
      const ok = check.ok(rows);
      if (!ok) failed++;
      console.log(`${ok ? "✓" : "✗"} ${check.name}${ok ? "" : ` → ${JSON.stringify(rows)}`}`);
    }
  } finally {
    await client.end();
  }
  if (failed > 0) {
    console.error(`\n${failed} verificación(es) fallaron.`);
    process.exit(1);
  }
  console.log("\nBase de datos OK.");
}

main().catch((error: unknown) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
