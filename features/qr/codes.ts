/**
 * QR del negocio (puro): códigos cortos, a dónde lleva cada QR y qué escaneos
 * cuentan. Un QR es de toda la sucursal, de una mesa o de una campaña
 * ("Volante", "Instagram"); todos apuntan a {app}/q/{código}.
 */

export type QrKind = "branch" | "table" | "campaign";

export const QR_KIND_LABELS: Record<QrKind, string> = {
  branch: "Sucursal",
  table: "Mesa",
  campaign: "Campaña",
};

/** Sin 0/O, 1/l/I: se puede dictar o copiar a mano sin confundirse. */
export const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 7;
export const MAX_TABLES_AT_ONCE = 50;
export const MAX_TABLE_NUMBER = 999;

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
/** Formato de los códigos que se generan hoy. */
export const isShortCode = (value: string) => CODE_RE.test(value);
/** Lo que puede llegar a /q/{code}: también los códigos viejos (p. ej. "demo01" del seed). */
export const isScannableCode = (value: string) => /^[A-Za-z0-9_-]{4,32}$/.test(value);

/** Código aleatorio (sin sesgo: descarta los bytes que no caben parejo en el alfabeto). */
export function newShortCode(
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
) {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH * 2)) {
      if (byte >= limit) continue;
      code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === CODE_LENGTH) break;
    }
  }
  return code;
}

/** Link corto que va impreso: https://dominio/q/Ab3dE7k */
export const qrLink = (appUrl: string, code: string) => `${appUrl.replace(/\/+$/, "")}/q/${code}`;

/** Menú de la sucursal; con mesa, la hoja de pedido ya trae "Mesa 4". */
export function menuPath(businessSlug: string, branchSlug: string, table?: string | null) {
  const base = `/${businessSlug}/${branchSlug}`;
  return table ? `${base}?mesa=${encodeURIComponent(table)}` : base;
}

/** Mesas "desde–hasta" → ["1", "2", …]; null si el rango no es válido. */
export function tableRange(from: number, to: number): string[] | null {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
  if (from < 1 || to > MAX_TABLE_NUMBER || to < from) return null;
  if (to - from + 1 > MAX_TABLES_AT_ONCE) return null;
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}

/** Tipo de un QR guardado (la mesa está en table_label; sucursal vs campaña en style.kind). */
export function qrKind(row: { table_label: string | null; style: unknown }): QrKind {
  if (row.table_label) return "table";
  const kind = (row.style as { kind?: unknown } | null)?.kind;
  return kind === "campaign" ? "campaign" : "branch";
}

/**
 * Vistas previas de enlaces (WhatsApp, Facebook, Slack…) y buscadores piden
 * el link sin que nadie haya escaneado: no cuentan.
 */
export function isBotUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|skype|linkedin|embedly|curl|wget|python|node-fetch|headless/i.test(
    userAgent,
  );
}
