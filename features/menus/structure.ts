/**
 * Estructura del menú en el editor (pura): secciones con productos del catálogo.
 * El editor trabaja con `key` locales; al guardar, el servidor reemplaza la
 * estructura completa en una transacción (los ids de sección/ítem no se usan
 * fuera del menú).
 */

export const MAX_SECTIONS = 30;
export const MAX_ITEMS_PER_SECTION = 200;

export const MENU_TEMPLATES = [
  { value: "clasico", label: "Clásico", free: true },
  { value: "galeria", label: "Galería", free: false },
  { value: "minimal", label: "Minimal", free: false },
  { value: "tarjetas", label: "Tarjetas", free: false },
] as const;

export type MenuTemplate = (typeof MENU_TEMPLATES)[number]["value"];

export type DraftItem = {
  key: string;
  productId: string;
  /** Precio especial en este menú; vacío = precio del catálogo. */
  price: string;
  isFeatured: boolean;
};

export type DraftSection = {
  key: string;
  name: string;
  description: string;
  items: DraftItem[];
};

let counter = 0;
/** Llave local estable para React y dnd-kit (no es el id de la base). */
export const newKey = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function emptySection(name = ""): DraftSection {
  return { key: newKey("s"), name, description: "", items: [] };
}

/** Agrega productos al final de la sección, sin repetir los que ya tiene. */
export function addProducts(section: DraftSection, productIds: readonly string[]): DraftSection {
  const present = new Set(section.items.map((i) => i.productId));
  const added = [...new Set(productIds)]
    .filter((id) => !present.has(id))
    .map((productId) => ({ key: newKey("i"), productId, price: "", isFeatured: false }));
  return { ...section, items: [...section.items, ...added] };
}

/** Mueve un producto a otra sección (al final). Si ya estaba allí, solo lo quita del origen. */
export function moveItemToSection(
  sections: readonly DraftSection[],
  itemKey: string,
  targetSectionKey: string,
): DraftSection[] {
  const from = sections.find((s) => s.items.some((i) => i.key === itemKey));
  const item = from?.items.find((i) => i.key === itemKey);
  if (!from || !item || from.key === targetSectionKey) return [...sections];
  return sections.map((s) => {
    if (s.key === from.key) return { ...s, items: s.items.filter((i) => i.key !== itemKey) };
    if (s.key === targetSectionKey) {
      return s.items.some((i) => i.productId === item.productId)
        ? s
        : { ...s, items: [...s.items, item] };
    }
    return s;
  });
}

/** Copia una sección con llaves nuevas, justo debajo de la original. */
export function duplicateSection(
  sections: readonly DraftSection[],
  sectionKey: string,
): DraftSection[] {
  const index = sections.findIndex((s) => s.key === sectionKey);
  if (index < 0) return [...sections];
  const source = sections[index]!;
  const copy: DraftSection = {
    ...source,
    key: newKey("s"),
    name: `${source.name} (copia)`.slice(0, 60),
    items: source.items.map((i) => ({ ...i, key: newKey("i") })),
  };
  return [...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)];
}

export function menuStats(sections: readonly DraftSection[]) {
  return {
    sections: sections.length,
    items: sections.reduce((n, s) => n + s.items.length, 0),
  };
}

/** "4 secciones · 12 productos" */
export function statsLabel({ sections, items }: { sections: number; items: number }) {
  const s = sections === 1 ? "1 sección" : `${sections} secciones`;
  const p = items === 1 ? "1 producto" : `${items} productos`;
  return `${s} · ${p}`;
}

/** Plantillas que puede usar el negocio: Gratis solo Clásico. */
export function allowedTemplates(hasAllTemplates: boolean): MenuTemplate[] {
  return MENU_TEMPLATES.filter((t) => t.free || hasAllTemplates).map((t) => t.value);
}
