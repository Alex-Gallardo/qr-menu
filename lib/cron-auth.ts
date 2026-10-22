import { createHash, timingSafeEqual } from "node:crypto";

/**
 * ¿La llamada trae "Authorization: Bearer <CRON_SECRET>"? (Vercel Cron lo
 * manda solo; pg_cron de Supabase lo manda desde scripts/push-cron.ts.)
 * Sin CRON_SECRET configurado, nadie pasa. Comparación en tiempo constante.
 */
export function isCronAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 16 || !header) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
