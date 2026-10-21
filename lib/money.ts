const formatter = new Intl.NumberFormat("es-GT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea centavos enteros como quetzales: 13100 → "Q131.00". */
export function formatQ(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("El monto debe estar en centavos enteros");
  const sign = cents < 0 ? "-" : "";
  return `${sign}Q${formatter.format(Math.abs(cents) / 100)}`;
}

/** "45", "45.5", "Q 1,490.00" → centavos (4500, 4550, 149000). Inválido o negativo → null. */
export function parseQ(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number")
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  const clean = input.replace(/[Qq\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** Centavos → texto para un input ("4500" → "45", "4550" → "45.50"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
