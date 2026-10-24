"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { actionError, type ActionResult } from "@/lib/action-result";
import { getAuthUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { parseQ } from "@/lib/money";
import { featureOverrides, parseLimitOverrides, parseSlugList } from "./admin";
import { requirePlatformAction } from "./access";
import {
  closeStaffSessions,
  createAssistedBusiness,
  ownerAccessLink,
  startImpersonation,
  stopImpersonation,
} from "./businesses";
import {
  changePlan,
  extendLicense,
  registerManualPayment,
  rejectPayment,
  setLicenseStatus,
  updateLicenseTerms,
  updateOverrides,
  verifyPayment,
} from "./licenses";
import {
  announcementSchema,
  assistedBusinessSchema,
  businessOnlySchema,
  changePlanSchema,
  extendSchema,
  impersonateSchema,
  manualPaymentSchema,
  overridesSchema,
  paymentIdSchema,
  planPriceSchema,
  rejectSchema,
  settingsSchema,
  statusSchema,
  termsSchema,
} from "./schemas";
import {
  deleteAnnouncement,
  saveAnnouncement,
  savePlatformSettings,
  setPlanPrice,
} from "./settings";

/*
 * Acciones del super admin: Zod → requirePlatformAction(permiso) → servidor.
 * Cada servidor deja su license_event y su auditoría (actor "platform").
 */

function firstIssue(error: { issues: { message: string }[] }) {
  return { ok: false as const, message: error.issues[0]?.message ?? "Revisa los datos." };
}

async function origin() {
  const h = await headers();
  return h.get("origin") ?? BRAND.url;
}

export async function changePlanAction(input: unknown): Promise<ActionResult> {
  const parsed = changePlanSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("licenses.edit");
    await changePlan(parsed.data.businessId, parsed.data.planId, { actorId: user.id });
    return { ok: true, message: "Plan cambiado." };
  } catch (error) {
    return actionError(error);
  }
}

export async function extendLicenseAction(input: unknown): Promise<ActionResult> {
  const parsed = extendSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("licenses.extend");
    await extendLicense(parsed.data.businessId, parsed.data.days, { actorId: user.id });
    return { ok: true, message: `Extendida ${parsed.data.days} días.` };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateTermsAction(input: unknown): Promise<ActionResult> {
  const parsed = termsSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("licenses.extend");
    await updateLicenseTerms(
      parsed.data.businessId,
      {
        priceOverrideGtq: parsed.data.priceOverride ? Number(parsed.data.priceOverride) : null,
        graceDays: parsed.data.graceDays,
        notes: parsed.data.notes || null,
      },
      { actorId: user.id },
    );
    return { ok: true, message: "Guardado." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateOverridesAction(input: unknown): Promise<ActionResult> {
  const parsed = overridesSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  let limits: Prisma.InputJsonValue | null;
  try {
    limits = parseLimitOverrides(parsed.data.limits) as Prisma.InputJsonValue | null;
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  try {
    const { user } = await requirePlatformAction("licenses.edit");
    await updateOverrides(
      parsed.data.businessId,
      { limits, features: featureOverrides(parsed.data.features) },
      { actorId: user.id },
    );
    return { ok: true, message: "Límites y funciones guardados." };
  } catch (error) {
    return actionError(error);
  }
}

export async function setStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("licenses.status");
    await setLicenseStatus(parsed.data.businessId, parsed.data.status, parsed.data.reason, {
      actorId: user.id,
    });
    return { ok: true, message: "Estado cambiado." };
  } catch (error) {
    return actionError(error);
  }
}

export async function verifyPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = paymentIdSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("payments.verify");
    const { endsAt } = await verifyPayment(parsed.data.paymentId, { actorId: user.id });
    return {
      ok: true,
      message: `Verificado: activa hasta el ${endsAt.toISOString().slice(0, 10)}.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("payments.verify");
    await rejectPayment(parsed.data.paymentId, parsed.data.reason, { actorId: user.id });
    return { ok: true, message: "Pago rechazado; el negocio ve el motivo." };
  } catch (error) {
    return actionError(error);
  }
}

export async function manualPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = manualPaymentSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("payments.verify");
    const { endsAt } = await registerManualPayment(
      {
        businessId: parsed.data.businessId,
        planId: parsed.data.planId,
        period: parsed.data.period,
        amountCents: parseQ(parsed.data.amount)!,
        reference: parsed.data.reference,
      },
      { actorId: user.id },
    );
    return {
      ok: true,
      message: `Pago registrado: activa hasta el ${endsAt.toISOString().slice(0, 10)}.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function createAssistedBusinessAction(
  input: unknown,
): Promise<ActionResult<{ businessId: string; inviteLink: string }>> {
  const parsed = assistedBusinessSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("businesses.create");
    const { priceOverride, notes, ...rest } = parsed.data;
    const res = await createAssistedBusiness(
      {
        ...rest,
        priceOverrideGtq: priceOverride ? Number(priceOverride) : null,
        notes: notes || null,
      },
      { actorId: user.id },
    );
    return {
      ok: true,
      message: "Negocio creado. Comparte el link con el dueño.",
      data: {
        businessId: res.businessId,
        inviteLink: new URL(res.invitePath, await origin()).toString(),
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function accessLinkAction(
  input: unknown,
): Promise<ActionResult<{ email: string; link: string }>> {
  const parsed = businessOnlySchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("support.access");
    const res = await ownerAccessLink(parsed.data.businessId, await origin(), { actorId: user.id });
    return { ok: true, message: `Enlace para ${res.email} listo.`, data: res };
  } catch (error) {
    return actionError(error);
  }
}

export async function closeStaffSessionsAction(input: unknown): Promise<ActionResult> {
  const parsed = businessOnlySchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("support.access");
    const count = await closeStaffSessions(parsed.data.businessId, { actorId: user.id });
    return {
      ok: true,
      message: `Cerramos ${count} ${count === 1 ? "sesión" : "sesiones"} de staff.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function startImpersonationAction(input: unknown): Promise<ActionResult> {
  const parsed = impersonateSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("businesses.impersonate");
    await startImpersonation(parsed.data.businessId, parsed.data.reason, { actorId: user.id });
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function stopImpersonationAction(): Promise<ActionResult> {
  try {
    const user = await getAuthUser();
    if (user) await stopImpersonation(user.id);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("settings.edit");
    const d = parsed.data;
    await savePlatformSettings(
      {
        maintenance: { enabled: d.maintenanceEnabled, message: d.maintenanceMessage },
        trialDays: d.trialDays,
        founderTrialDays: d.founderTrialDays,
        graceDays: d.graceDays,
        reservedSlugs: parseSlugList(d.reservedSlugs),
        paymentAccounts: d.paymentAccounts,
      },
      { actorId: user.id },
    );
    return { ok: true, message: "Configuración guardada." };
  } catch (error) {
    return actionError(error);
  }
}

export async function setPlanPriceAction(input: unknown): Promise<ActionResult> {
  const parsed = planPriceSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("settings.edit");
    await setPlanPrice(parsed.data.planId, parsed.data.priceGtq, { actorId: user.id });
    return { ok: true, message: "Precio guardado." };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveAnnouncementAction(input: unknown): Promise<ActionResult> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("settings.edit");
    const d = parsed.data;
    await saveAnnouncement(
      {
        id: d.id,
        title: d.title,
        body: d.body,
        audience: d.audience.toLowerCase(),
        startsAt: new Date(`${d.startsAt}T06:00:00Z`),
        endsAt: d.endsAt ? new Date(`${d.endsAt}T06:00:00Z`) : null,
        isActive: d.isActive,
      },
      { actorId: user.id },
    );
    return { ok: true, message: "Anuncio guardado." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteAnnouncementAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const { user } = await requirePlatformAction("settings.edit");
    await deleteAnnouncement(parsed.data.id, { actorId: user.id });
    return { ok: true, message: "Anuncio borrado." };
  } catch (error) {
    return actionError(error);
  }
}
