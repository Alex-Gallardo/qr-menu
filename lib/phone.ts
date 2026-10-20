/**
 * Teléfonos de Guatemala: 8 dígitos (fijos 2/6/7, móviles 3/4/5).
 * Se guardan en E.164 (+50255551234), que es lo que usa wa.me.
 */

const GT_LOCAL = /^[2-7]\d{7}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/** "5555-1234", "+502 5555 1234", "50255551234" → "+50255551234"; inválido → null. */
export function toE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (GT_LOCAL.test(digits)) return `+502${digits}`;
  if (digits.startsWith("502") && GT_LOCAL.test(digits.slice(3))) return `+${digits}`;
  // Otro país, escrito en formato internacional con "+".
  if (trimmed.startsWith("+") && E164.test(`+${digits}`)) return `+${digits}`;
  return null;
}

/** "+50255551234" → "5555-1234" (o el número completo si es de otro país). */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  if (e164.startsWith("+502") && e164.length === 12) {
    return `${e164.slice(4, 8)}-${e164.slice(8)}`;
  }
  return e164;
}
