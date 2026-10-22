import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicConfig } from "./config";

export type SessionClaims = {
  sub: string;
  email?: string;
  is_anonymous?: boolean;
  aal?: "aal1" | "aal2";
};

/**
 * Refresca la sesión de Supabase en cada petición (rota cookies vencidas) y
 * devuelve los claims verificados. `response()` incluye las cookies nuevas;
 * cualquier redirect debe copiarlas con `withSessionCookies`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Sin Supabase configurado (entorno nuevo de Vercel), el sitio público debe
  // seguir funcionando: se continúa sin sesión y las rutas privadas piden entrar.
  const config = supabasePublicConfig();
  if (!config) {
    warnOnce();
    return { claims: null, response: () => response };
  }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  return { claims: await readClaims(supabase), response: () => response };
}

/**
 * getClaims verifica la firma del JWT; no confiar en getSession() en el servidor.
 * Un fallo de red pasajero (llaves JWKS, refresco del token) se reintenta una
 * vez: tratarlo como "sin sesión" saca al usuario a /entrar sin motivo. Si
 * Supabase sigue sin responder, se trata como sin sesión (nunca se abre una
 * ruta privada).
 */
async function readClaims(
  supabase: ReturnType<typeof createServerClient>,
): Promise<SessionClaims | null> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await supabase.auth.getClaims();
      if (!error) return (data?.claims ?? null) as SessionClaims | null;
      // Sin sesión, token vencido o revocado: respuesta normal, no se reintenta.
      if (!isAuthRetryableFetchError(error)) return null;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
  }
  console.error("[proxy] No se pudo verificar la sesión con Supabase:", lastError);
  return null;
}

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    "[proxy] Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY: el acceso al panel está desactivado. Revisa /api/health.",
  );
}

/** Copia las cookies de sesión refrescadas a otra respuesta (redirect o rewrite). */
export function withSessionCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}
