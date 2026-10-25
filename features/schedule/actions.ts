"use server";

import { updateTag } from "next/cache";
import { validationError, z } from "@/lib/zod";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { tags } from "@/lib/cache-tags";
import { overrideSchema, scheduleGridSchema, slotFormSchema, type OverrideInput } from "./schemas";
import { deleteOverride, overrideBranch, saveScheduleGrid, upsertOverride } from "./program-server";
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

export async function saveSlot(input: unknown): Promise<ActionResult> {
  const parsed = slotFormSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
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
  if (!parsed.success) return validationError(parsed.error);
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
  if (!parsed.success) return validationError(parsed.error);
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
  if (!parsed.success) return validationError(parsed.error);
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

// ── Programación semanal y fechas especiales (QRM-018) ─────────────────────

/**
 * General (todas las sucursales): solo el dueño. Por sucursal: el dueño o el
 * encargado de esa sucursal. La cuadrícula general pide "scheduling" y la de
 * sucursal "branch_scheduling" (plan Negocio).
 */
async function scheduleEditor(businessId: string, branchId: string | null) {
  const { user } = await requireAccess(
    businessId,
    branchId
      ? { branchId, feature: "branch_scheduling", write: true }
      : { roles: ["owner"], feature: "scheduling", write: true },
  );
  return { actorId: user.id };
}

const publishedSchedule = (businessId: string, branchId: string | null) => {
  updateTag(tags.business(businessId));
  if (branchId) updateTag(tags.branch(branchId));
};

/** Autoguardado de la cuadrícula. */
export async function saveScheduleAction(input: unknown): Promise<ActionResult> {
  const parsed = scheduleGridSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, branchId, cells } = parsed.data;
  try {
    const ctx = await scheduleEditor(businessId, branchId);
    await saveScheduleGrid(businessId, branchId, cells, ctx);
    publishedSchedule(businessId, branchId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/** Fechas especiales: "Cerrado" en cualquier plan; un menú distinto pide "scheduling". */
async function overrideEditor(businessId: string, branchId: string | null, withMenu: boolean) {
  const { user } = await requireAccess(businessId, {
    ...(branchId ? { branchId } : { roles: ["owner"] }),
    ...(withMenu ? { feature: "scheduling" as const } : {}),
    write: true,
  });
  return { actorId: user.id };
}

export async function saveOverrideAction(input: unknown): Promise<ActionResult> {
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, branchId, menuId } = parsed.data;
  try {
    const ctx = await overrideEditor(businessId, branchId, menuId !== null);
    await upsertOverride(parsed.data, ctx);
    publishedSchedule(businessId, branchId);
    return {
      ok: true,
      message: menuId ? "Guardamos la fecha especial." : "Listo: ese día queda cerrado.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeOverrideAction(
  input: unknown,
): Promise<ActionResult<{ restore: OverrideInput }>> {
  const parsed = z.object({ businessId: z.uuid(), overrideId: z.uuid() }).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, overrideId } = parsed.data;
  try {
    const branchId = await overrideBranch(businessId, overrideId);
    const ctx = await overrideEditor(businessId, branchId, false);
    const row = await deleteOverride(businessId, overrideId, ctx);
    publishedSchedule(businessId, branchId);
    return {
      ok: true,
      data: {
        restore: {
          businessId,
          branchId: row.branch_id,
          date: row.date,
          slotId: row.time_slot_id,
          menuId: row.menu_id,
          note: row.note ?? "",
        },
      },
    };
  } catch (error) {
    return actionError(error);
  }
}
