"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { safeNext } from "@/lib/auth/route-rules";
import { requireUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorMessage } from "./errors";
import {
  magicLinkSchema,
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  totpSchema,
} from "./schemas";

export type { ActionResult } from "@/lib/action-result";

function invalid(error: z.ZodError): ActionResult {
  return { ok: false, message: error.issues[0]?.message ?? "Revisa los datos." };
}

/** Origen de la petición (localhost, preview o producción) para los enlaces de correo. */
async function origin() {
  const h = await headers();
  return h.get("origin") ?? BRAND.url;
}

async function callbackUrl(next: string) {
  return `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithPassword(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, message: authErrorMessage(error) };

  redirect(safeNext(parsed.data.next));
}

export async function sendMagicLink(input: unknown): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Solo entrar: las cuentas nuevas se crean en /registro.
      shouldCreateUser: false,
      emailRedirectTo: await callbackUrl(safeNext(parsed.data.next)),
    },
  });
  // No revelar si el correo tiene cuenta: misma respuesta salvo por límite de envíos.
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    return { ok: false, message: authErrorMessage(error) };
  }
  return { ok: true, message: "Si ese correo tiene cuenta, te llegará un enlace para entrar." };
}

export async function signUp(input: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: await callbackUrl("/onboarding"),
    },
  });
  if (error) return { ok: false, message: authErrorMessage(error) };

  // Con confirmación de correo desactivada, Supabase ya devuelve la sesión.
  if (data.session) redirect("/onboarding");
  return {
    ok: true,
    message: `Te enviamos un correo a ${parsed.data.email}. Ábrelo para confirmar tu cuenta.`,
  };
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await callbackUrl("/recuperar/nueva"),
  });
  if (error?.code === "over_email_send_rate_limit") {
    return { ok: false, message: authErrorMessage(error) };
  }
  return {
    ok: true,
    message: "Si ese correo tiene cuenta, te llegará un enlace para cambiar tu contraseña.",
  };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  await requireUser("/recuperar/nueva");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: authErrorMessage(error) };

  redirect("/panel");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export type TotpEnrollment =
  { ok: true; factorId: string; qr: string; secret: string } | { ok: false; message: string };

/** Alta de TOTP (la dispara el usuario con un botón): limpia altas a medias y crea una nueva. */
export async function enrollTotp(): Promise<TotpEnrollment> {
  await requireUser("/entrar/2fa");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { ok: false, message: authErrorMessage(error) };

  for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const enrolled = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `${BRAND.name} ${new Date().toISOString()}`,
    issuer: BRAND.name,
  });
  if (enrolled.error) return { ok: false, message: authErrorMessage(enrolled.error) };
  return {
    ok: true,
    factorId: enrolled.data.id,
    qr: enrolled.data.totp.qr_code,
    secret: enrolled.data.totp.secret,
  };
}

export async function verifyTotp(input: unknown): Promise<ActionResult> {
  const parsed = totpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  await requireUser("/entrar/2fa");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) return { ok: false, message: authErrorMessage(error) };

  redirect(safeNext(parsed.data.next, "/admin"));
}
