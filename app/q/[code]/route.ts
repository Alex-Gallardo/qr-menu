import { NextResponse, type NextRequest } from "next/server";
import { isBotUserAgent } from "@/features/qr/codes";
import { resolveScan } from "@/features/qr/server";
import { BRAND } from "@/lib/brand";

/**
 * QR impreso → menú de la sucursal (con la mesa si es de mesa). Cuenta el
 * escaneo salvo las vistas previas de enlaces y los bots. Nunca se cachea:
 * cada escaneo debe llegar aquí.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/q/[code]">) {
  const { code } = await ctx.params;
  const count = !isBotUserAgent(request.headers.get("user-agent"));
  const target = await resolveScan(code, { count }).catch((error: unknown) => {
    console.error("[q] No se pudo resolver el QR:", error);
    return undefined;
  });

  if (target) {
    // ?origen=qr: el menú cuenta la visita como llegada por QR (y lo quita de la barra).
    const url = new URL(target, request.url);
    url.searchParams.set("origen", "qr");
    const response = NextResponse.redirect(url, 302);
    response.headers.set("cache-control", "no-store");
    return response;
  }

  // Código desconocido (o la base no respondió): una página corta en lugar de un error.
  const message =
    target === null
      ? "Este código QR ya no está activo. Pide el menú al personal o busca el negocio en internet."
      : "No pudimos abrir el menú en este momento. Escanea el código otra vez en un momento.";
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${BRAND.name}</title></head><body style="font-family:system-ui,sans-serif;max-width:28rem;margin:20vh auto;padding:0 1.5rem;text-align:center;color:#231A17;background:#FBF6EE"><p style="font-size:1.125rem;line-height:1.5">${message}</p><p><a href="/" style="color:#D23B22;font-weight:600">Ir a ${BRAND.name}</a></p></body></html>`,
    {
      status: target === null ? 404 : 503,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}
