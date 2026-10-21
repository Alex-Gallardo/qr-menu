import { effectivePriceCents } from "@/features/products/catalog";
import type {
  ResolverMenu,
  ResolverOverride,
  ResolverRule,
  ResolverSlot,
} from "@/features/schedule/resolve-active-menu";

/**
 * Lo que recibe el celular del cliente para una sucursal (puro). Incluye todos
 * los menús activos y las reglas que aplican a la sucursal: el navegador
 * resuelve el menú del día con la hora de Guatemala (resolveActiveMenu).
 */

export type RawProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  image_url: string | null;
  image_blurhash: string | null;
  tags: string[];
  is_available: boolean;
  hidden_by_license: boolean;
  deleted_at: Date | null;
  prep_minutes: number | null;
  branch_settings: {
    branch_id: string;
    is_available: boolean;
    price_override_cents: number | null;
  }[];
  option_groups: {
    id: string;
    name: string;
    min_select: number;
    max_select: number;
    options: { id: string; name: string; price_delta_cents: number; is_available: boolean }[];
  }[];
};

export type RawMenu = {
  id: string;
  name: string;
  description: string | null;
  template: string | null;
  is_active: boolean;
  is_default: boolean;
  hidden_by_license: boolean;
  sections: {
    id: string;
    name: string;
    description: string | null;
    items: { product_id: string; price_override_cents: number | null; is_featured: boolean }[];
  }[];
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  blurhash: string | null;
  /** Precio en esta sucursal (sin precio especial de menú). */
  priceCents: number;
  compareAtCents: number | null;
  tags: string[];
  /** false = agotado (en todas o solo en esta sucursal). */
  available: boolean;
  prepMinutes: number | null;
  optionGroups: RawProduct["option_groups"];
};

export type PublicMenuItem = {
  productId: string;
  /** Precio final en este menú y sucursal. */
  priceCents: number;
  featured: boolean;
};

export type PublicMenu = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  isDefault: boolean;
  sections: { id: string; name: string; description: string | null; items: PublicMenuItem[] }[];
};

export type BranchMenuPayload = {
  products: Record<string, PublicProduct>;
  menus: PublicMenu[];
  resolver: {
    slots: ResolverSlot[];
    menus: ResolverMenu[];
    rules: ResolverRule[];
    overrides: ResolverOverride[];
  };
};

export function buildBranchMenu(input: {
  branchId: string;
  products: RawProduct[];
  menus: RawMenu[];
  slots: ResolverSlot[];
  rules: ResolverRule[];
  overrides: ResolverOverride[];
}): BranchMenuPayload {
  const { branchId } = input;
  const visibleMenus = input.menus.filter((m) => m.is_active && !m.hidden_by_license);

  const products: Record<string, PublicProduct> = {};
  const branchPrice = new Map<string, number | null>();
  for (const p of input.products) {
    if (p.deleted_at || p.hidden_by_license) continue;
    const setting = p.branch_settings.find((s) => s.branch_id === branchId);
    branchPrice.set(p.id, setting?.price_override_cents ?? null);
    products[p.id] = {
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.image_url,
      blurhash: p.image_blurhash,
      priceCents: effectivePriceCents({
        basePriceCents: p.price_cents,
        branchPriceCents: setting?.price_override_cents,
      }),
      compareAtCents: p.compare_at_cents,
      tags: p.tags,
      available: p.is_available && setting?.is_available !== false,
      prepMinutes: p.prep_minutes,
      optionGroups: p.option_groups,
    };
  }

  const menus: PublicMenu[] = visibleMenus.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    template: m.template ?? "clasico",
    isDefault: m.is_default,
    sections: m.sections
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        items: s.items
          .filter((i) => products[i.product_id])
          .map((i) => {
            const product = input.products.find((p) => p.id === i.product_id)!;
            return {
              productId: i.product_id,
              priceCents: effectivePriceCents({
                basePriceCents: product.price_cents,
                menuPriceCents: i.price_override_cents,
                branchPriceCents: branchPrice.get(i.product_id),
              }),
              featured: i.is_featured,
            };
          }),
      }))
      .filter((s) => s.items.length > 0),
  }));

  return {
    products,
    menus,
    resolver: {
      slots: input.slots,
      menus: input.menus.map((m) => ({
        id: m.id,
        is_active: m.is_active,
        is_default: m.is_default,
        hidden_by_license: m.hidden_by_license,
      })),
      // Solo las reglas de esta sucursal y las generales.
      rules: input.rules.filter((r) => r.branch_id === null || r.branch_id === branchId),
      overrides: input.overrides.filter((o) => o.branch_id === null || o.branch_id === branchId),
    },
  };
}
