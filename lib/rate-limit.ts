import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Límite de solicitudes con ventana fija, en Postgres (tabla rate_limits):
 * un solo INSERT … ON CONFLICT atómico, sin servicios extra. Lo usan los
 * pedidos (5 por sesión cada 10 min, 30 por IP por hora) y luego PIN y subidas.
 */

export type RateLimitResult = { ok: boolean; count: number; retryAfterSec: number };

export async function hitRateLimit(
  key: string,
  { limit, windowSec }: { limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const rows = await db().$queryRaw<{ count: number; window_start: Date }[]>`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSec}::int)
        THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE
        WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSec}::int)
        THEN now() ELSE rate_limits.window_start END
    RETURNING count, window_start`;
  const row = rows[0]!;
  // De vez en cuando se limpian las ventanas viejas (no hace falta un cron).
  if (Math.random() < 0.01) {
    void db()
      .$executeRaw`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`.catch(
      () => {},
    );
  }
  const ends = row.window_start.getTime() + windowSec * 1000;
  return {
    ok: row.count <= limit,
    count: row.count,
    retryAfterSec: Math.max(1, Math.ceil((ends - Date.now()) / 1000)),
  };
}

/** La IP nunca se guarda tal cual: hash con sal del servidor. */
export function hashIp(ip: string) {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "qrm";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** "en 3 minutos", "en 1 minuto". */
export function retryLabel(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}
