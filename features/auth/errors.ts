/** Errores de Supabase Auth → mensajes amables, sin culpa y sin jerga. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "El correo o la contraseña no coinciden. Probemos otra vez.",
  email_not_confirmed: "Antes de entrar, confirma tu correo con el enlace que te enviamos.",
  user_already_exists: "Ya existe una cuenta con ese correo. ¿Quieres entrar?",
  email_exists: "Ya existe una cuenta con ese correo. ¿Quieres entrar?",
  weak_password: "Esa contraseña es muy fácil de adivinar. Prueba con una más larga.",
  same_password: "La nueva contraseña debe ser distinta a la anterior.",
  over_email_send_rate_limit:
    "Enviamos varios correos seguidos. Espera un minuto y probemos otra vez.",
  over_request_rate_limit: "Demasiados intentos seguidos. Espera un momento y probemos otra vez.",
  otp_expired: "El enlace ya venció. Pide uno nuevo.",
  mfa_verification_failed: "Ese código no es válido. Revisa tu app y probemos otra vez.",
  mfa_challenge_expired: "El código venció. Escribe el que muestra tu app ahora.",
  session_not_found: "Tu sesión terminó. Vuelve a entrar.",
  signup_disabled: "Por ahora no estamos aceptando registros nuevos.",
};

export const GENERIC_AUTH_ERROR = "No pudimos completar eso. Probemos otra vez en un momento.";

export function authErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return GENERIC_AUTH_ERROR;
  return (error.code && MESSAGES[error.code]) || GENERIC_AUTH_ERROR;
}
