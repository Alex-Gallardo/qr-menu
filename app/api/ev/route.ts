import { after, type NextRequest } from "next/server";
import { recordEvents } from "@/features/analytics/server";
import { eventBatchSchema } from "@/features/analytics/schemas";
import { isBotUserAgent } from "@/features/qr/codes";
import { hashIp, hitRateLimit } from "@/lib/rate-limit";

/**
 * Eventos del menú público (visitas, productos vistos, carrito), enviados con
 * navigator.sendBeacon. Anónimo: siempre responde 204 y guarda después de
 * responder; descarta bots, lotes inválidos y excesos (por dispositivo e IP).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text().catch(() => "");
  if (raw.length > 0 && raw.length <= 8_000 && !isBotUserAgent(request.headers.get("user-agent"))) {
    let json: unknown = null;
    try {
      json = JSON.parse(raw);
    } catch {
      // Lote ilegible: se descarta.
    }
    const parsed = eventBatchSchema.safeParse(json);
    if (parsed.success) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip");
      after(async () => {
        try {
          const session = await hitRateLimit(`ev:s:${parsed.data.sessionId}`, {
            limit: 60,
            windowSec: 600,
          });
          if (!session.ok) return;
          // Un restaurante comparte la IP del wifi: el límite por IP es amplio.
          if (ip) {
            const byIp = await hitRateLimit(`ev:ip:${hashIp(ip)}`, {
              limit: 2000,
              windowSec: 3600,
            });
            if (!byIp.ok) return;
          }
          await recordEvents(parsed.data);
        } catch (error) {
          console.error("[ev] No se pudieron guardar los eventos:", error);
        }
      });
    }
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
