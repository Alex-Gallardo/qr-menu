import { centsToInput } from "@/lib/money";
import type { ProductTag } from "./catalog";
import { deltaToInput, type GroupRule } from "./options";
import type { ProductFormInput } from "./schemas";

type ProductForForm = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  image_url: string | null;
  image_blurhash: string | null;
  tags: string[];
  is_available: boolean;
  prep_minutes: number | null;
  branch_settings: {
    branch_id: string;
    is_available: boolean;
    price_override_cents: number | null;
  }[];
  option_groups?: (GroupRule & {
    id: string;
    name: string;
    options: { id: string; name: string; price_delta_cents: number; is_available: boolean }[];
  })[];
};

/** Producto de la base → valores del formulario (una fila por sucursal visible). */
export function toProductFormInput(
  businessId: string,
  product: ProductForForm | null,
  branchIds: string[],
  defaults: { categoryId?: string } = {},
): ProductFormInput {
  const setting = (branchId: string) =>
    product?.branch_settings.find((s) => s.branch_id === branchId);
  return {
    businessId,
    productId: product?.id,
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product ? (product.category_id ?? "") : (defaults.categoryId ?? ""),
    price: product ? centsToInput(product.price_cents) : "",
    compare_at: centsToInput(product?.compare_at_cents),
    tags: (product?.tags ?? []) as ProductTag[],
    prep_minutes: product?.prep_minutes ? String(product.prep_minutes) : "",
    image_url: product?.image_url ?? null,
    image_blurhash: product?.image_blurhash ?? null,
    is_available: product?.is_available ?? true,
    branches: branchIds.map((branchId) => ({
      branchId,
      is_available: setting(branchId)?.is_available ?? true,
      price: centsToInput(setting(branchId)?.price_override_cents),
    })),
    groups: (product?.option_groups ?? []).map((g) => ({
      groupId: g.id,
      name: g.name,
      required: g.min_select > 0,
      min: String(Math.max(1, g.min_select)),
      max: String(g.max_select),
      options: g.options.map((o) => ({
        optionId: o.id,
        name: o.name,
        price: deltaToInput(o.price_delta_cents),
        is_available: o.is_available,
      })),
    })),
  };
}
