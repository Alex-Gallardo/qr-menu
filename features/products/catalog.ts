/**
 * Reglas del catálogo (puras, sin base de datos): el producto es del negocio y
 * cada sucursal puede agotarlo o cambiarle el precio sin afectar a las demás.
 */

export const PRODUCT_TAGS = [
  { value: "popular", label: "Popular" },
  { value: "nuevo", label: "Nuevo" },
  { value: "picante", label: "Picante" },
  { value: "vegetariano", label: "Vegetariano" },
] as const;

export type ProductTag = (typeof PRODUCT_TAGS)[number]["value"];

export const TAG_VALUES = PRODUCT_TAGS.map((t) => t.value) as [ProductTag, ...ProductTag[]];

export type CatalogProduct = {
  price_cents: number;
  /** false = agotado en todas las sucursales. */
  is_available: boolean;
  hidden_by_license?: boolean;
  deleted_at?: Date | null;
};

export type BranchSetting = {
  branch_id: string;
  /** false = agotado solo en esa sucursal. */
  is_available: boolean;
  price_override_cents: number | null;
};

export type BranchView = {
  /** Precio que ve el cliente en esa sucursal. */
  priceCents: number;
  available: boolean;
  /** Por qué no se puede pedir: agotado en todas, solo aquí, u oculto. */
  unavailableReason: "everywhere" | "this_branch" | "hidden" | null;
  /** La sucursal tiene su propio precio. */
  hasOwnPrice: boolean;
};

/**
 * Precio final, en el orden de la guía: producto → precio especial del menú →
 * precio de la sucursal (el último que exista gana).
 */
export function effectivePriceCents(input: {
  basePriceCents: number;
  menuPriceCents?: number | null;
  branchPriceCents?: number | null;
}) {
  return input.branchPriceCents ?? input.menuPriceCents ?? input.basePriceCents;
}

/** Cómo se ve un producto en una sucursal. Sin fila en branch_products hereda todo. */
export function viewForBranch(
  product: CatalogProduct,
  branchId: string,
  settings: readonly BranchSetting[],
  menuPriceCents?: number | null,
): BranchView {
  const setting = settings.find((s) => s.branch_id === branchId);
  const priceCents = effectivePriceCents({
    basePriceCents: product.price_cents,
    menuPriceCents,
    branchPriceCents: setting?.price_override_cents,
  });
  const hasOwnPrice = setting?.price_override_cents != null;

  let unavailableReason: BranchView["unavailableReason"] = null;
  if (product.deleted_at || product.hidden_by_license) unavailableReason = "hidden";
  else if (!product.is_available) unavailableReason = "everywhere";
  else if (setting && !setting.is_available) unavailableReason = "this_branch";

  return { priceCents, available: unavailableReason === null, unavailableReason, hasOwnPrice };
}

/** Sucursales donde el producto está agotado solo ahí (para el resumen de la lista). */
export function soldOutBranchIds(settings: readonly BranchSetting[]) {
  return settings.filter((s) => !s.is_available).map((s) => s.branch_id);
}

/**
 * Una fila de branch_products solo hace falta si cambia algo respecto al
 * catálogo; si queda igual al valor por defecto se borra.
 */
export function isDefaultSetting(
  setting: Pick<BranchSetting, "is_available" | "price_override_cents">,
) {
  return setting.is_available && setting.price_override_cents === null;
}

/** Búsqueda sin tildes ni mayúsculas: "cafe" encuentra "Café de olla". */
export function normalizeSearch(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function matchesSearch(fields: (string | null | undefined)[], query: string) {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = normalizeSearch(fields.filter(Boolean).join(" "));
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/** Nombre para el duplicado: "Café" → "Café (copia)", "Café (copia)" → "Café (copia 2)". */
export function copyName(name: string, existing: readonly string[]) {
  const base = name.replace(/ \(copia(?: \d+)?\)$/, "");
  const taken = new Set(existing);
  let candidate = `${base} (copia)`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base} (copia ${n})`;
  return candidate.slice(0, 80);
}

/** Intercambia un elemento con su vecino; devuelve el nuevo orden o null si no se mueve. */
export function moveInList<T>(items: readonly T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return null;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
