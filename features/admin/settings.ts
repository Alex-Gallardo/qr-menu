import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { mergeReserved } from "@/features/businesses/slug";
import { PLATFORM_SETTINGS_DEFAULTS } from "@/features/platform/defaults";
import type { PaymentAccount } from "@/features/billing/server";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { parseMaintenance } from "@/lib/platform/maintenance";

type Ctx = { actorId: string };

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Configuración global que se edita en /admin/configuracion. */
export async function getPlatformSettings() {
  const rows = await db().platform_settings.findMany({
    where: {
      key: {
        in: [
          "maintenance_mode",
          "trial_days",
          "founder_trial_days",
          "grace_days",
          "reserved_slugs",
          "payment_accounts",
        ],
      },
    },
    select: { key: true, value: true },
  });
  const get = (key: string) =>
    rows.find((r) => r.key === key)?.value ?? PLATFORM_SETTINGS_DEFAULTS[key];
  const accounts = Array.isArray(get("payment_accounts"))
    ? (get("payment_accounts") as PaymentAccount[])
    : [];
  const reserved = Array.isArray(get("reserved_slugs")) ? (get("reserved_slugs") as string[]) : [];
  return {
    maintenance: parseMaintenance(get("maintenance_mode")),
    trialDays: num(get("trial_days"), 14),
    founderTrialDays: num(get("founder_trial_days"), 60),
    graceDays: num(get("grace_days"), 7),
    reservedSlugs: reserved,
    /** Los fijos de la app (no se pueden quitar). */
    builtInSlugs: [...mergeReserved([])],
    paymentAccounts: accounts,
  };
}

export type PlatformSettingsInput = {
  maintenance: { enabled: boolean; message: string };
  trialDays: number;
  founderTrialDays: number;
  graceDays: number;
  reservedSlugs: string[];
  paymentAccounts: PaymentAccount[];
};

export async function savePlatformSettings(input: PlatformSettingsInput, { actorId }: Ctx) {
  const values: Record<string, Prisma.InputJsonValue> = {
    maintenance_mode: input.maintenance,
    trial_days: input.trialDays,
    founder_trial_days: input.founderTrialDays,
    grace_days: input.graceDays,
    reserved_slugs: input.reservedSlugs,
    payment_accounts: input.paymentAccounts,
  };
  await db().$transaction(
    Object.entries(values).map(([key, value]) =>
      db().platform_settings.upsert({
        where: { key },
        create: { key, value, updated_by: actorId },
        update: { value, updated_by: actorId },
      }),
    ),
  );
  await audit({
    actorId,
    actorKind: "platform",
    businessId: null,
    action: "settings.update",
    entity: "platform_settings",
    diff: {
      maintenance: input.maintenance.enabled,
      trial_days: input.trialDays,
      grace_days: input.graceDays,
      reserved_slugs: input.reservedSlugs.length,
      payment_accounts: input.paymentAccounts.length,
    },
  });
}

/** Precio de lista de un plan (los límites y funciones siguen en el catálogo). */
export async function setPlanPrice(planId: string, priceGtq: number, { actorId }: Ctx) {
  const plan = await db().plans.findUnique({ where: { id: planId }, select: { price_gtq: true } });
  if (!plan) throw new AppError("not_found", "Ese plan no existe.");
  await db().plans.update({ where: { id: planId }, data: { price_gtq: priceGtq } });
  await audit({
    actorId,
    actorKind: "platform",
    businessId: null,
    action: "plan.price",
    entity: "plans",
    entityId: planId,
    diff: { from: plan.price_gtq, to: priceGtq },
  });
}

export async function listAnnouncements() {
  return db().announcements.findMany({ orderBy: { starts_at: "desc" }, take: 100 });
}

export async function saveAnnouncement(
  input: {
    id?: string;
    title: string;
    body: string;
    audience: string;
    startsAt: Date;
    endsAt: Date | null;
    isActive: boolean;
  },
  { actorId }: Ctx,
) {
  const data = {
    title: input.title,
    body: input.body,
    audience: input.audience,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    is_active: input.isActive,
  };
  const row = input.id
    ? await db().announcements.update({ where: { id: input.id }, data, select: { id: true } })
    : await db().announcements.create({ data, select: { id: true } });
  await audit({
    actorId,
    actorKind: "platform",
    businessId: null,
    action: input.id ? "announcement.update" : "announcement.create",
    entity: "announcements",
    entityId: row.id,
    diff: { title: input.title, audience: input.audience, active: input.isActive },
  });
  return row;
}

export async function deleteAnnouncement(id: string, { actorId }: Ctx) {
  await db().announcements.delete({ where: { id } });
  await audit({
    actorId,
    actorKind: "platform",
    businessId: null,
    action: "announcement.delete",
    entity: "announcements",
    entityId: id,
  });
}
