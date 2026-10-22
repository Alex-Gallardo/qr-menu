import { connection } from "next/server";
import { pushEnabled, sendDueReminders } from "@/features/notifications/server";
import { isCronAuthorized } from "@/lib/cron-auth";

/**
 * Cada minuto (pg_cron de Supabase o Vercel Cron en el plan Pro): repite el
 * aviso de los pedidos que siguen "nuevos" (3, 6 y 9 min) y avisa 30 min antes
 * de los programados. Todo con la hora de la base. Protegido con CRON_SECRET.
 */
export async function GET(request: Request) {
  await connection();
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return Response.json({ ok: false }, { status: 401, headers: { "cache-control": "no-store" } });
  if (!pushEnabled())
    return Response.json(
      { ok: false, reason: "Faltan las llaves VAPID" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  const result = await sendDueReminders();
  return Response.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
}
