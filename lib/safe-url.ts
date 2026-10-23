/**
 * Solo URLs https sin comillas, paréntesis ni espacios: un valor guardado en la
 * base no puede romper el HTML ni el CSS (`url(...)`) donde se inserta.
 */
export function safeHttpsUrl(value: string | null | undefined): string | null {
  const v = value?.trim() ?? "";
  if (!/^https:\/\/[^\s"'()<>\\]+$/.test(v)) return null;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}
