import { connection } from "next/server";
import { runLicenseLifecycle } from "@/features/licensing/lifecycle-server";
import { isCronAuthorized } from "@/lib/cron-auth";

/**
 * Una vez al día (Vercel Cron, vercel.json): pasa a gracia las licencias
 * vencidas, baja a Gratis las que terminaron la prueba o la gracia y manda los
 * avisos de 7, 3 y 1 día. Protegido con CRON_SECRET.
 */
export async function GET(request: Request) {
  await connection();
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return Response.json({ ok: false }, { status: 401, headers: { "cache-control": "no-store" } });
  const result = await runLicenseLifecycle();
  return Response.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
}
