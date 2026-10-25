"use server";

import { updateTag } from "next/cache";
import { validationError, z } from "@/lib/zod";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { tags } from "@/lib/cache-tags";
import { menuDocumentSchema, menuNameSchema } from "./schemas";
import {
  createMenu,
  deleteMenu,
  duplicateMenu,
  restoreMenu,
  saveMenuDocument,
  setDefaultMenu,
  setMenuActive,
} from "./server";

/** Menús: dueño y encargado (tabla de permisos de la guía). */
async function editorOf(businessId: string) {
  const { user, entitlements } = await requireAccess(businessId, { write: true });
  return { actorId: user.id, entitlements };
}

/** El menú público se arma con los menús: cada cambio se publica al instante. */
const published = (businessId: string) => updateTag(tags.business(businessId));

export async function createMenuAction(input: unknown): Promise<ActionResult<{ menuId: string }>> {
  const parsed = z.object({ businessId: z.uuid(), name: menuNameSchema }).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, name } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    const menu = await createMenu(businessId, name, ctx);
    published(businessId);
    return { ok: true, data: { menuId: menu.id } };
  } catch (error) {
    return actionError(error);
  }
}

/** Autoguardado del editor. */
export async function saveMenu(input: unknown): Promise<ActionResult> {
  const parsed = menuDocumentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { entitlements } = await editorOf(parsed.data.businessId);
    await saveMenuDocument(parsed.data, entitlements);
    published(parsed.data.businessId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

const menuRef = z.object({ businessId: z.uuid(), menuId: z.uuid() });

export async function duplicateMenuAction(
  input: unknown,
): Promise<ActionResult<{ menuId: string }>> {
  const parsed = menuRef.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, menuId } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    const copy = await duplicateMenu(businessId, menuId, ctx);
    published(businessId);
    return { ok: true, message: `Creamos “${copy.name}” (en pausa).`, data: { menuId: copy.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleMenu(input: unknown): Promise<ActionResult> {
  const parsed = menuRef.extend({ active: z.boolean() }).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, menuId, active } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    await setMenuActive(businessId, menuId, active, ctx);
    published(businessId);
    return { ok: true, message: active ? "Menú activo." : "Menú en pausa: no se muestra." };
  } catch (error) {
    return actionError(error);
  }
}

export async function makeDefaultMenu(input: unknown): Promise<ActionResult> {
  const parsed = menuRef.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, menuId } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    await setDefaultMenu(businessId, menuId, ctx);
    published(businessId);
    return { ok: true, message: "Listo: es tu menú predeterminado." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeMenu(
  input: unknown,
): Promise<ActionResult<{ name: string; schedules: number; wasDefault: boolean }>> {
  const parsed = menuRef.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, menuId } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    const removed = await deleteMenu(businessId, menuId, ctx);
    published(businessId);
    return { ok: true, data: removed };
  } catch (error) {
    return actionError(error);
  }
}

export async function undoRemoveMenu(input: unknown): Promise<ActionResult> {
  const parsed = menuRef.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, menuId } = parsed.data;
  try {
    const ctx = await editorOf(businessId);
    await restoreMenu(businessId, menuId, ctx);
    published(businessId);
    return { ok: true, message: "Recuperamos el menú y su programación." };
  } catch (error) {
    return actionError(error);
  }
}
