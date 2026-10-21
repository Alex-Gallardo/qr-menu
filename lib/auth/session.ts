import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginUrl } from "./route-rules";

export type AuthUser = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  aal: "aal1" | "aal2";
};

/** Usuario de la sesión actual (JWT verificado). Una lectura por request. */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  // La sesión es siempre de la petición: validar el JWT usa la hora actual.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    isAnonymous: claims.is_anonymous === true,
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

/** Exige un usuario con email (no la sesión anónima de un dispositivo de staff). */
export async function requireUser(next: string): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user || user.isAnonymous) redirect(loginUrl(next));
  return user;
}

export const getProfile = cache(async (userId: string) =>
  db().profiles.findUnique({
    where: { id: userId },
    select: { id: true, full_name: true, platform_role: true },
  }),
);

/**
 * Exige equipo de la plataforma con 2FA verificado en esta sesión (aal2).
 * Sin rol → 404 (no revelar que /admin existe). Sin 2FA → /entrar/2fa.
 */
export async function requirePlatformUser(next = "/admin") {
  const user = await requireUser(next);
  const profile = await getProfile(user.id);
  if (!profile || profile.platform_role === "none") notFound();
  if (user.aal !== "aal2") redirect(`/entrar/2fa?next=${encodeURIComponent(next)}`);
  return { user, profile };
}
