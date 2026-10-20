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
