import { centsToInput } from "@/lib/money";
import type { ProductTag } from "./catalog";
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
  };
}
