import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );

  // getClaims verifica la firma del JWT; no confiar en getSession() en el servidor.
  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? null) as SessionClaims | null;

  return { claims, response: () => response };
}

/** Copia las cookies de sesión refrescadas a otra respuesta (redirect o rewrite). */
export function withSessionCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}
