"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { tags } from "@/lib/cache-tags";
import { slotFormSchema } from "./schemas";
import { createSlot, deleteSlot, restoreSlot, setSlotActive, updateSlot } from "./server";

/**
 * Las franjas son del negocio y afectan a todas las sucursales: solo el dueño
 * las edita (el encargado programa sus sucursales en QRM-018).
 */
async function ownerOf(businessId: string) {
  const { user } = await requireAccess(businessId, { roles: ["owner"], write: true });
  return { actorId: user.id };
}

/** El menú público resuelve el menú del día con las franjas: se publica al instante. */
const published = (businessId: string) => updateTag(tags.business(businessId));

const firstIssue = (error: z.ZodError) => ({
  ok: false as const,
  message: error.issues[0]?.message ?? "Revisa los datos.",
});

export async function saveSlot(input: unknown): Promise<ActionResult> {
  const parsed = slotFormSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, slotId } = parsed.data;
  try {
    const ctx = await ownerOf(businessId);
    if (slotId) await updateSlot({ ...parsed.data, slotId }, ctx);
    else await createSlot(parsed.data, ctx);
    published(businessId);
    return {
      ok: true,
      message: slotId ? "¡Listo! Guardamos la franja." : "¡Listo! Agregamos la franja.",
    };
  } catch (error) {
    return actionError(error);
  }
}

const slotRef = z.object({ businessId: z.uuid(), slotId: z.uuid() });

export async function toggleSlot(input: unknown): Promise<ActionResult> {
  const parsed = slotRef.extend({ active: z.boolean() }).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, slotId, active } = parsed.data;
  try {
    const ctx = await ownerOf(businessId);
    await setSlotActive(businessId, slotId, active, ctx);
    published(businessId);
    return {
      ok: true,
      message: active ? "Franja activa." : "Franja en pausa: no se muestra en el menú.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeSlot(
  input: unknown,
): Promise<ActionResult<{ name: string; schedules: number }>> {
  const parsed = slotRef.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, slotId } = parsed.data;
  try {
    const ctx = await ownerOf(businessId);
    const removed = await deleteSlot(businessId, slotId, ctx);
    published(businessId);
    return { ok: true, data: removed };
  } catch (error) {
    return actionError(error);
  }
}

export async function undoRemoveSlot(input: unknown): Promise<ActionResult> {
  const parsed = slotRef.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, slotId } = parsed.data;
  try {
    const ctx = await ownerOf(businessId);
    await restoreSlot(businessId, slotId, ctx);
    published(businessId);
    return { ok: true, message: "Recuperamos la franja y su programación." };
  } catch (error) {
    return actionError(error);
  }
}
