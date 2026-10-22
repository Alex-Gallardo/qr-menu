import { NextResponse, type NextRequest } from "next/server";
import { decideRoute, STAFF_DEVICE_COOKIE } from "@/lib/auth/route-rules";
import { getMaintenance } from "@/lib/platform/maintenance";
import { updateSession, withSessionCookies } from "@/lib/supabase/proxy";

/**
 * Proxy (antes "middleware"): refresca la sesión, protege /panel, /onboarding,
 * /admin y /staff, y aplica el modo mantenimiento. Las reglas viven en
 * lib/auth/route-rules.ts.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  const [{ claims, response }, maintenance] = await Promise.all([
    updateSession(request),
    getMaintenance(),
  ]);

  const decision = decideRoute({
    pathname,
    search,
    isUser: !!claims && !claims.is_anonymous,
    isStaffSession: !!claims?.is_anonymous,
    hasStaffDevice: request.cookies.has(STAFF_DEVICE_COOKIE),
    maintenance: maintenance.enabled,
    isServerAction,
  });

  if (decision.type === "redirect") {
    return withSessionCookies(NextResponse.redirect(new URL(decision.to, request.url)), response());
  }

  if (decision.type === "maintenance" && isServerAction) {
    // Next muestra el texto de una respuesta text/plain con error; la página
    // de mantenimiento (HTML) llegaría como "respuesta inesperada".
    return new NextResponse(maintenance.message, {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }

  if (decision.type === "maintenance") {
    const headers = new Headers(request.headers);
    headers.set("x-maintenance-message", encodeURIComponent(maintenance.message));
    return withSessionCookies(
      NextResponse.rewrite(new URL("/mantenimiento", request.url), {
        status: 503,
        request: { headers },
      }),
      response(),
    );
  }

  return response();
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos, optimización de imágenes, íconos y el túnel de Sentry.
    "/((?!_next/static|_next/image|api/monitoring|icon.svg|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp3|mp4|webmanifest)$).*)",
  ],
};
