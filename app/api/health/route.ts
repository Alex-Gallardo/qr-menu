import { connection } from "next/server";
import { FREE_PLAN_ID } from "@/features/licensing/server";
import { db } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Estado de la configuración del entorno, para revisar un deploy sin adivinar.
 * Solo dice sí/no por pieza: nunca devuelve valores ni secretos.
 * 200 si todo lo obligatorio está bien; 503 si falta algo.
 */

type Check = { name: string; ok: boolean; required: boolean; hint: string };

const present = (value: string | undefined) => Boolean(value && value.trim());

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function databaseChecks(): Promise<Check[]> {
  if (!present(process.env.DATABASE_URL)) {
    return [
      {
        name: "database",
        ok: false,
        required: true,
        hint: "Falta DATABASE_URL (pooler, puerto 6543).",
      },
      { name: "plans", ok: false, required: true, hint: "Sin base no se pueden leer los planes." },
    ];
  }
  try {
    await withTimeout(db().$queryRaw`select 1`, 3000);
  } catch (error) {
    // db() valida todas las variables del servidor: distinguir "falta config" de "no conecta".
    const missingEnv = error instanceof Error && error.message.includes("Variables de entorno");
    return [
      {
        name: "database",
        ok: false,
        required: true,
        hint: missingEnv
          ? "Faltan variables del servidor (DIRECT_URL o las de Supabase): revisa .env.example."
          : "DATABASE_URL no conecta. Revisa la cadena y la contraseña.",
      },
      { name: "plans", ok: false, required: true, hint: "Sin base no se pueden leer los planes." },
    ];
  }
  const database: Check = { name: "database", ok: true, required: true, hint: "Conecta." };
  try {
    const plan = await withTimeout(
      db().plans.findUnique({ where: { id: FREE_PLAN_ID }, select: { id: true } }),
      3000,
    );
    return [
      database,
      plan
        ? { name: "plans", ok: true, required: true, hint: "Planes cargados." }
        : {
            name: "plans",
            ok: false,
            required: true,
            hint: "Faltan los planes: corre SEED_SCOPE=base pnpm db:seed.",
          },
    ];
  } catch {
    return [
      database,
      {
        name: "plans",
        ok: false,
        required: true,
        hint: "Faltan las tablas: corre pnpm db:deploy.",
      },
    ];
  }
}

export async function GET() {
  await connection();

  const checks: Check[] = [
    {
      name: "supabase",
      ok: isSupabaseConfigured(),
      required: true,
      hint: "NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (requieren un nuevo deploy al cambiarlas).",
    },
    {
      name: "supabase_service_role",
      ok: present(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: true,
      hint: "SUPABASE_SERVICE_ROLE_KEY (subida de fotos y tareas del servidor).",
    },
    ...(await databaseChecks()),
    {
      name: "app_url",
      ok: present(process.env.NEXT_PUBLIC_APP_URL),
      required: false,
      hint: "NEXT_PUBLIC_APP_URL con el dominio del entorno (links y correos).",
    },
    {
      name: "map_tiles",
      ok: present(process.env.NEXT_PUBLIC_MAP_TILE_URL),
      required: false,
      hint: "NEXT_PUBLIC_MAP_TILE_URL (MapTiler o Stadia). Sin ella se usa OSM, solo apto para desarrollo.",
    },
    {
      name: "sentry",
      ok: present(process.env.NEXT_PUBLIC_SENTRY_DSN),
      required: false,
      hint: "NEXT_PUBLIC_SENTRY_DSN para ver los errores (sin marcar Sensitive).",
    },
  ];

  const ok = checks.every((c) => c.ok || !c.required);
  return Response.json(
    { ok, checks },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
