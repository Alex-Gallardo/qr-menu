import { z } from "zod";

/** Esquemas compartidos por los formularios (cliente) y las Server Actions. */

const email = z
  .string()
  .trim()
  .min(1, "Escribe tu correo.")
  .pipe(z.email("Ese correo no parece válido."))
  .transform((v) => v.toLowerCase());

const password = z
  .string()
  .min(8, "Usa al menos 8 caracteres.")
  .max(72, "Usa como máximo 72 caracteres.");

export const nextSchema = z.string().optional();

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Escribe tu contraseña."),
  next: nextSchema,
});

export const magicLinkSchema = z.object({ email, next: nextSchema });

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre.").max(80),
  email,
  password,
  /** A dónde volver al confirmar (p. ej. una invitación de equipo); por defecto, el asistente. */
  next: nextSchema,
});

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden.",
  });

export const totpSchema = z.object({
  factorId: z.string().min(1),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Escribe los 6 números de tu app de autenticación."),
  next: nextSchema,
});

export type SignInInput = z.input<typeof signInSchema>;
export type MagicLinkInput = z.input<typeof magicLinkSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type ResetRequestInput = z.input<typeof resetRequestSchema>;
export type NewPasswordInput = z.input<typeof newPasswordSchema>;
export type TotpInput = z.input<typeof totpSchema>;
