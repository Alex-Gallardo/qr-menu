import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/route-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Destino de los enlaces de correo (confirmar cuenta, enlace mágico, recuperar
 * contraseña): canjea el código por una sesión y sigue a `next`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const fail = () => NextResponse.redirect(new URL("/entrar?error=enlace", request.url));

  if (params.get("error_code") || params.get("error")) return fail();

  const supabase = await createSupabaseServerClient();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Enlace incompleto") };

  if (error) return fail();
  return NextResponse.redirect(new URL(next, request.url));
}
