"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { tags } from "@/lib/cache-tags";
import { AccessError } from "@/lib/errors";
import { categoryNameSchema, productFormSchema } from "./schemas";
import {
  createCategory,
  createProduct,
  deleteCategory,
  duplicateProduct,
  moveCategory,
  moveProduct,
  renameCategory,
  restoreCategory,
  restoreProduct,
  setBranchAvailable,
  setProductAvailable,
  softDeleteProduct,
  updateProduct,
  type DeletedCategory,
} from "./server";

/**
 * Catálogo: dueño y encargado (tabla de permisos de la guía). La configuración
 * por sucursal solo en las sucursales que cada uno puede ver.
 */
async function editorOf(businessId: string, branchId?: string) {
  const { user, member } = await requireAccess(businessId, { branchId, write: true });
  return { actorId: user.id, member };
}

/** Después de escribir: el menú público lo muestra al instante. */
const published = (businessId: string, branchId?: string) => {
  updateTag(tags.business(businessId));
  if (branchId) updateTag(tags.branch(branchId));
};

const firstIssue = (error: z.ZodError) => ({
  ok: false as const,
  message: error.issues[0]?.message ?? "Revisa los datos.",
});

export async function saveProduct(input: unknown): Promise<ActionResult<{ productId: string }>> {
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, productId } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    if (productId) {
      await updateProduct({ ...parsed.data, productId }, ctx);
      published(businessId);
      return { ok: true, message: "¡Listo! Guardamos el producto.", data: { productId } };
    }
    const product = await createProduct(parsed.data, ctx);
    published(businessId);
    return {
      ok: true,
      message: "¡Listo! Agregamos el producto.",
      data: { productId: product.id },
    };
  } catch (error) {
    return actionError(error);
  }
}

const productRef = z.object({ businessId: z.uuid(), productId: z.uuid() });

const availabilitySchema = productRef.extend({
  available: z.boolean(),
  /** Sin sucursal = el interruptor del catálogo (todas las sucursales). */
  branchId: z.uuid().optional(),
});

export async function setAvailability(input: unknown): Promise<ActionResult> {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, productId, available, branchId } = parsed.data;
  try {
    const ctx = await editorOf(businessId, branchId);
    if (branchId) {
      await setBranchAvailable(businessId, branchId, productId, available, ctx);
    } else {
      // Agotar en todas afecta sucursales ajenas: solo quien las ve todas.
      if (!ctx.member.allBranches) {
        throw new AccessError(
          "branch_forbidden",
          "Solo puedes cambiar la disponibilidad en tus sucursales.",
        );
      }
      await setProductAvailable(businessId, productId, available, ctx);
    }
    published(businessId, branchId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeProduct(input: unknown): Promise<ActionResult<{ name: string }>> {
  const parsed = productRef.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, productId } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    const removed = await softDeleteProduct(businessId, productId, ctx);
    published(businessId);
    return { ok: true, data: removed };
  } catch (error) {
    return actionError(error);
  }
}

export async function undoRemoveProduct(input: unknown): Promise<ActionResult> {
  const parsed = productRef.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, productId } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    await restoreProduct(businessId, productId, ctx);
    published(businessId);
    return { ok: true, message: "Recuperamos el producto." };
  } catch (error) {
    return actionError(error);
  }
}

export async function duplicate(input: unknown): Promise<ActionResult<{ productId: string }>> {
  const parsed = productRef.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, productId } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    const copy = await duplicateProduct(businessId, productId, ctx);
    published(businessId);
    return { ok: true, message: `Creamos “${copy.name}”.`, data: { productId: copy.id } };
  } catch (error) {
    return actionError(error);
  }
}

const moveSchema = productRef.extend({ direction: z.union([z.literal(-1), z.literal(1)]) });

export async function moveProductAction(input: unknown): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, productId, direction } = parsed.data;
  try {
    await editorOf(businessId);
    await moveProduct(businessId, productId, direction);
    published(businessId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

// ── Categorías ──────────────────────────────────────────────────────────────

const categoryInput = z.object({
  businessId: z.uuid(),
  categoryId: z.uuid().optional(),
  name: categoryNameSchema,
});

export async function saveCategory(
  input: unknown,
): Promise<ActionResult<{ categoryId: string; name: string }>> {
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, categoryId, name } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    if (categoryId) {
      await renameCategory(businessId, categoryId, name, ctx);
      published(businessId);
      return { ok: true, message: "Guardamos la categoría.", data: { categoryId, name } };
    }
    const category = await createCategory(businessId, name, ctx);
    published(businessId);
    return {
      ok: true,
      message: "Agregamos la categoría.",
      data: { categoryId: category.id, name: category.name },
    };
  } catch (error) {
    return actionError(error);
  }
}

const categoryRef = z.object({ businessId: z.uuid(), categoryId: z.uuid() });

export async function removeCategory(
  input: unknown,
): Promise<ActionResult<{ deleted: DeletedCategory }>> {
  const parsed = categoryRef.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, categoryId } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    const deleted = await deleteCategory(businessId, categoryId, ctx);
    published(businessId);
    return { ok: true, data: { deleted } };
  } catch (error) {
    return actionError(error);
  }
}

/** Lo borrado viene del navegador: se valida completo antes de recrearlo. */
const deletedCategorySchema = z.object({
  businessId: z.uuid(),
  deleted: z.object({
    category: z.object({
      id: z.uuid(),
      name: categoryNameSchema,
      sort: z.number().int().min(0).max(10_000),
    }),
    productIds: z.array(z.uuid()).max(5_000),
  }),
});

export async function undoRemoveCategory(input: unknown): Promise<ActionResult> {
  const parsed = deletedCategorySchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, deleted } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    await restoreCategory(businessId, deleted, ctx);
    published(businessId);
    return { ok: true, message: "Recuperamos la categoría." };
  } catch (error) {
    return actionError(error);
  }
}

export async function moveCategoryAction(input: unknown): Promise<ActionResult> {
  const parsed = categoryRef
    .extend({ direction: z.union([z.literal(-1), z.literal(1)]) })
    .safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, categoryId, direction } = parsed.data;
  try {
    await editorOf(businessId);
    await moveCategory(businessId, categoryId, direction);
    published(businessId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
