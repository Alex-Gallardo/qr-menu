import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { defaultWeek } from "@/features/branches/hours";
import { slugProblem } from "@/features/businesses/server";
import { SLUG_MESSAGES, slugify } from "@/features/businesses/slug";
import { inviteExpiry, invitePath } from "@/features/team/team";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { toE164 } from "@/lib/phone";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Ctx = { actorId: string };
const DAY = 24 * 60 * 60 * 1000;

export type AssistedBusinessInput = {
  name: string;
  slug: string;
  branchName: string;
  whatsapp: string;
  ownerEmail: string;
  planId: "gratis" | "pro" | "negocio";
  trialDays: number;
  priceOverrideGtq: number | null;
  notes: string | null;
};

/**
 * Alta asistida (guía A1): negocio sin publicar + licencia (prueba, precio
 * especial, nota) + primera sucursal + menú principal, y una invitación de
 * DUEÑO para el correo del prospecto. Devuelve el link de la invitación.
 */
export async function createAssistedBusiness(input: AssistedBusinessInput, { actorId }: Ctx) {
  const problem = await slugProblem(input.slug, "");
  if (problem) throw new AppError(`slug_${problem}`, SLUG_MESSAGES[problem]);
  const whatsapp = toE164(input.whatsapp);
  if (!whatsapp) throw new AppError("validation", "Escribe un WhatsApp de 8 dígitos.");
  const token = randomBytes(24).toString("base64url");
  const branchSlug =
    slugify(input.branchName).length >= 3 ? slugify(input.branchName) : "principal";

  const business = await db().businesses.create({
    data: {
      name: input.name,
      slug: input.slug,
      theme: { create: {} },
      license: {
        create: {
          plan_id: input.planId,
          status: input.planId === "gratis" ? "active" : "trial",
          ends_at: new Date(Date.now() + input.trialDays * DAY),
          price_override_gtq: input.priceOverrideGtq,
          notes: input.notes,
          updated_by: actorId,
          events: {
            create: {
              type: "created",
              actor_id: actorId,
              data: { plan: input.planId, trial_days: input.trialDays, assisted: true },
            },
          },
        },
      },
      branches: {
        create: {
          name: input.branchName,
          slug: branchSlug,
          whatsapp_e164: whatsapp,
          hours: {
            create: defaultWeek()
              .filter((d) => d.open)
              .map((d) => ({ weekday: d.weekday, opens: d.opens, closes: d.closes })),
          },
        },
      },
      menus: { create: { name: "Menú principal", template: "clasico", is_default: true } },
      invitations: {
        create: {
          email: input.ownerEmail.trim().toLowerCase(),
          role: "owner",
          all_branches: true,
          token_hash: createHash("sha256").update(token).digest("hex"),
          invited_by: actorId,
          expires_at: inviteExpiry(),
        },
      },
    },
    select: { id: true },
  });
  await audit({
    actorId,
    actorKind: "platform",
    businessId: business.id,
    action: "business.create_assisted",
    entity: "businesses",
    entityId: business.id,
    diff: { name: input.name, slug: input.slug, plan: input.planId, owner: input.ownerEmail },
  });
  return { businessId: business.id, invitePath: invitePath(token) };
}

/**
 * Enlace de acceso para el dueño (soporte): un magic link de Supabase que el
 * admin le manda por WhatsApp. Abre su panel.
 */
export async function ownerAccessLink(businessId: string, origin: string, { actorId }: Ctx) {
  const owners = await db().$queryRaw<{ email: string }[]>`
    SELECT u.email FROM business_members m JOIN auth.users u ON u.id = m.user_id
    WHERE m.business_id = ${businessId}::uuid AND m.role = 'owner' AND u.email IS NOT NULL
    ORDER BY m.created_at LIMIT 1`;
  const email = owners[0]?.email;
  if (!email) throw new AppError("not_found", "Ese negocio aún no tiene dueño con cuenta.");
  const { data, error } = await createSupabaseAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/panel/${businessId}`)}`,
    },
  });
  if (error || !data.properties?.action_link)
    throw new AppError("auth", "No pudimos generar el enlace. Probemos otra vez.");
  await audit({
    actorId,
    actorKind: "platform",
    businessId,
    action: "support.access_link",
    entity: "businesses",
    entityId: businessId,
    diff: { email },
  });
  return { email, link: data.properties.action_link };
}

/** Cerrar todas las sesiones de staff abiertas del negocio. */
export async function closeStaffSessions(businessId: string, { actorId }: Ctx) {
  const { count } = await db().staff_sessions.updateMany({
    where: { business_id: businessId, ended_at: null },
    data: { ended_at: new Date() },
  });
  await audit({
    actorId,
    actorKind: "platform",
    businessId,
    action: "support.close_staff_sessions",
    entity: "staff_sessions",
    diff: { closed: count },
  });
  return count;
}

/** Cookie de "Entrar como el negocio" (solo lectura, 2 h). */
export const IMPERSONATION_COOKIE = "qrm_soporte";
const IMPERSONATION_MAX_AGE = 2 * 60 * 60;

export async function startImpersonation(businessId: string, reason: string, { actorId }: Ctx) {
  const exists = await db().businesses.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!exists) throw new AppError("not_found", "Ese negocio no existe.");
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/panel",
    maxAge: IMPERSONATION_MAX_AGE,
  });
  await audit({
    actorId,
    actorKind: "platform",
    businessId,
    action: "support.impersonate_start",
    entity: "businesses",
    entityId: businessId,
    diff: { mode: "solo lectura", reason },
  });
}

export async function stopImpersonation(actorId: string) {
  const store = await cookies();
  const businessId = store.get(IMPERSONATION_COOKIE)?.value ?? null;
  store.delete({ name: IMPERSONATION_COOKIE, path: "/panel" });
  if (businessId)
    await audit({
      actorId,
      actorKind: "platform",
      businessId,
      action: "support.impersonate_end",
      entity: "businesses",
      entityId: businessId,
    });
}
