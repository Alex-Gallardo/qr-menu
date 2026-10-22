/**
 * PIN del staff (puro): 4 a 6 dígitos; 5 intentos fallidos en un dispositivo
 * lo bloquean 5 minutos. El conteo vive en rate_limits ("pin:device:{id}"):
 * `count` = fallos seguidos y `windowStart` = el último fallo que cuenta (al
 * llegar a 5, el inicio del bloqueo).
 */

export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const MAX_PIN_FAILURES = 5;
export const PIN_LOCK_MS = 5 * 60 * 1000;
/** Fallos más viejos que esto ya no cuentan. */
export const PIN_FAILURE_TTL_MS = 15 * 60 * 1000;
/** Turno de staff: 12 horas. */
export const STAFF_SHIFT_MS = 12 * 60 * 60 * 1000;

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);

export type LockState =
  { locked: false; remaining: number } | { locked: true; retryAfterSec: number };

export function lockState(
  failures: { count: number; windowStart: Date } | null,
  now: Date,
): LockState {
  if (!failures) return { locked: false, remaining: MAX_PIN_FAILURES };
  const age = now.getTime() - failures.windowStart.getTime();
  if (failures.count >= MAX_PIN_FAILURES) {
    if (age < PIN_LOCK_MS)
      return { locked: true, retryAfterSec: Math.ceil((PIN_LOCK_MS - age) / 1000) };
    return { locked: false, remaining: MAX_PIN_FAILURES };
  }
  if (age > PIN_FAILURE_TTL_MS) return { locked: false, remaining: MAX_PIN_FAILURES };
  return { locked: false, remaining: MAX_PIN_FAILURES - failures.count };
}

/** "Espera 4 minutos", "Espera 1 minuto". */
export function lockMessage(retryAfterSec: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Demasiados intentos. Espera ${minutes} ${minutes === 1 ? "minuto" : "minutos"} y vuelve a probar.`;
}

export function wrongPinMessage(remaining: number) {
  if (remaining <= 0) return lockMessage(PIN_LOCK_MS / 1000);
  return `PIN incorrecto. Te ${remaining === 1 ? "queda 1 intento" : `quedan ${remaining} intentos`}.`;
}
