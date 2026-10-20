import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Factor TOTP verificado del usuario actual, si existe (solo lectura). */
export async function getVerifiedTotpFactorId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp.find((f) => f.status === "verified")?.id ?? null;
}
