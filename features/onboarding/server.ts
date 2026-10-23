import "server-only";
import { getMembership } from "@/lib/auth/require-access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { parseQ } from "@/lib/money";
import { defaultWeek } from "@/features/branches/hours";
import { slugProblem } from "@/features/businesses/server";
import { SLUG_MESSAGES, slugify } from "@/features/businesses/slug";
import { isRegisteredMediaUrl } from "@/features/media/server";
import { createQrCodes } from "@/features/qr/server";
import { assertWithinLimit } from "@/features/licensing/server";
import type { MenuTemplate } from "@/features/menus/structure";
import { minutesToPublish, type OnboardingProgress } from "./onboarding";
import type { BusinessStep, ProductsStep } from "./schemas";

/** Prueba de Pro para negocios nuevos (los días vienen de platform_settings). */
const TRIAL_PLAN = "pro";
const DAY = 24 * 60 * 60 * 1000;
const FIRST_SECTION = "Lo más pedido";

/**
 * Negocio del asistente: el primero donde el usuario es dueño. Si no tiene
 * ninguno, null (paso 1 lo crea).
 */
export async function getOnboarding(userId: string) {
  const member = await db().business_members.findFirst({
    where: { user_id: userId, role: "owner" },
    orderBy: { created_at: "asc" },
    select: { business_id: true },
  });
  if (!member) return null;
  const business = await db().businesses.findUnique({
    where: { id: member.business_id },
    select: {
      id: true,
      name: true,
      slug: true,
      logo_url: true,
      published: true,
      created_at: true,
      branches: {
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
        take: 1,
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          address_reference: true,
          city: true,
          lat: true,
          lng: true,
          whatsapp_e164: true,
        },
      },
      menus: {
        where: { is_default: true },
        take: 1,
        select: { id: true, template: true },
      },
      _count: { select: { products: { where: { deleted_at: null } } } },
    },
  });
  if (!business) return null;
  return {
    ...business,
    branch: business.branches[0] ?? null,
    menu: business.menus[0] ?? null,
    products: business._count.products,
  };
}

export type Onboarding = NonNullable<Awaited<ReturnType<typeof getOnboarding>>>;

export function progressOf(o: Onboarding | null): OnboardingProgress {
  return {
    hasBusiness: o !== null && o.branch !== null,
    hasLogo: Boolean(o?.logo_url),
    products: o?.products ?? 0,
    published: o?.published ?? false,
  };
}

async function trialDays() {
  const setting = await db().platform_settings.findUnique({
    where: { key: "trial_days" },
    select: { value: true },
  });
  const days = Number(setting?.value);
  return Number.isInteger(days) && days > 0 && days <= 90 ? days : 14;
}

async function assertSlug(slug: string, businessId: string) {
  const problem = await slugProblem(slug, businessId);
  if (problem) throw new AppError(`slug_${problem}`, SLUG_MESSAGES[problem]);
}

/** Link de la sucursal a partir de su nombre ("Zona 10" → "zona-10"). */
function branchSlug(name: string) {
  const slug = slugify(name);
  return slug.length >= 3 ? slug : "principal";
}

/**
 * Paso 1, primera vez: negocio + tema + licencia de prueba + dueño + sucursal
 * (horario lunes a sábado 8–20) + menú principal vacío, todo o nada.
 */
export async function createBusinessFromOnboarding(userId: string, input: BusinessStep) {
  const existing = await getOnboarding(userId);
  if (existing) return updateBusinessFromOnboarding(userId, existing.id, input);

  await assertSlug(input.slug, "");
  const days = await trialDays();
  const branch = {
    name: input.branchName,
    slug: branchSlug(input.branchName),
    address: input.address,
    address_reference: input.addressReference,
    city: input.city,
    lat: input.location?.lat ?? null,
    lng: input.location?.lng ?? null,
    whatsapp_e164: input.whatsapp,
    hours: {
      create: defaultWeek()
        .filter((d) => d.open)
        .map((d) => ({ weekday: d.weekday, opens: d.opens, closes: d.closes })),
    },
  };

  let business: { id: string };
  try {
    business = await db().businesses.create({
      data: {
        name: input.name,
        slug: input.slug,
        theme: { create: {} },
        license: {
          create: {
            plan_id: TRIAL_PLAN,
            status: "trial",
            ends_at: new Date(Date.now() + days * DAY),
            events: {
              create: {
                type: "created",
                data: { plan: TRIAL_PLAN, trial_days: days },
                actor_id: userId,
              },
            },
          },
        },
        members: { create: { user_id: userId, role: "owner", all_branches: true } },
        branches: { create: branch },
        menus: { create: { name: "Menú principal", template: "clasico", is_default: true } },
      },
      select: { id: true },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      throw new AppError("slug_taken", SLUG_MESSAGES.taken);
    throw error;
  }
  await audit({
    actorId: userId,
    actorKind: "user",
    businessId: business.id,
    action: "business.create",
    entity: "businesses",
    entityId: business.id,
    diff: { name: input.name, slug: input.slug, trial: `${TRIAL_PLAN} ${days} días` },
  });
  return { businessId: business.id };
}

/** Paso 1 otra vez (volvió atrás): corrige nombre, link y la sucursal. */
export async function updateBusinessFromOnboarding(
  userId: string,
  businessId: string,
  input: BusinessStep,
) {
  const member = await getMembership(userId, businessId);
  if (member?.role !== "owner") throw new AppError("forbidden", "No tienes acceso a este negocio.");
  await assertSlug(input.slug, businessId);
  const current = await getOnboarding(userId);
  const branchData = {
    name: input.branchName,
    address: input.address,
    address_reference: input.addressReference,
    city: input.city,
    lat: input.location?.lat ?? null,
    lng: input.location?.lng ?? null,
    whatsapp_e164: input.whatsapp,
  };
  try {
    await db().$transaction([
      db().businesses.update({
        where: { id: businessId },
        data: { name: input.name, slug: input.slug },
      }),
      current?.branch
        ? db().branches.update({ where: { id: current.branch.id }, data: branchData })
        : db().branches.create({
            data: { ...branchData, business_id: businessId, slug: branchSlug(input.branchName) },
          }),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      throw new AppError("slug_taken", SLUG_MESSAGES.taken);
    throw error;
  }
  await audit({
    actorId: userId,
    actorKind: "user",
    businessId,
    action: "business.update",
    entity: "businesses",
    entityId: businessId,
    diff: { name: input.name, slug: input.slug, onboarding: "paso 1" },
  });
  return { businessId };
}

/** Paso 2: plantilla del menú principal (la vista previa y el menú real la usan). */
export async function setDefaultTemplate(
  businessId: string,
  template: MenuTemplate,
  { allTemplates }: { allTemplates: boolean },
) {
  if (template !== "clasico" && !allTemplates)
    throw new AppError("feature_unavailable", "Tu plan incluye la plantilla Clásico.");
  await db().menus.updateMany({
    where: { business_id: businessId, is_default: true },
    data: { template },
  });
}

/**
 * Paso 3: los primeros productos (dentro del límite del plan) y, en el menú
 * principal, una sección "Lo más pedido" con ellos.
 */
export async function addFirstProducts(input: ProductsStep, { actorId }: { actorId: string }) {
  const { businessId, products } = input;
  await assertWithinLimit(businessId, "products", products.length);
  // Solo fotos subidas para este negocio.
  for (const p of products) {
    if (p.imageUrl && !(await isRegisteredMediaUrl(businessId, p.imageUrl)))
      throw new AppError("forbidden", "Esa foto no es de tu negocio.");
  }

  const menu =
    (await db().menus.findFirst({
      where: { business_id: businessId, is_default: true },
      select: { id: true },
    })) ??
    (await db().menus.create({
      data: {
        business_id: businessId,
        name: "Menú principal",
        template: "clasico",
        is_default: true,
      },
      select: { id: true },
    }));
  const lastSort = await db().products.aggregate({
    where: { business_id: businessId },
    _max: { sort: true },
  });
  const firstSort = (lastSort._max.sort ?? -1) + 1;

  const created = await db().$transaction(async (tx) => {
    const ids: string[] = [];
    for (const [i, p] of products.entries()) {
      const product = await tx.products.create({
        data: {
          business_id: businessId,
          name: p.name,
          price_cents: parseQ(p.price)!,
          image_url: p.imageUrl,
          image_blurhash: p.imageBlurhash,
          sort: firstSort + i,
        },
        select: { id: true },
      });
      ids.push(product.id);
    }
    const section =
      (await tx.menu_sections.findFirst({
        where: { menu_id: menu.id },
        orderBy: { sort: "asc" },
        select: { id: true },
      })) ??
      (await tx.menu_sections.create({
        data: { menu_id: menu.id, name: FIRST_SECTION, sort: 0 },
        select: { id: true },
      }));
    const lastItem = await tx.menu_items.aggregate({
      where: { section_id: section.id },
      _max: { sort: true },
    });
    const base = (lastItem._max.sort ?? -1) + 1;
    await tx.menu_items.createMany({
      data: ids.map((product_id, i) => ({
        section_id: section.id,
        product_id,
        sort: base + i,
        is_featured: base + i === 0,
      })),
    });
    return ids;
  });

  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: "product.create",
    entity: "products",
    diff: { onboarding: products.map((p) => `${p.name} Q${p.price}`) },
  });
  return { created: created.length };
}

/**
 * Paso 4: publicar. Marca el negocio como publicado (indexable), crea el QR
 * de la sucursal si no tiene y registra cuánto tardó desde el alta.
 */
export async function publishBusiness(businessId: string, { actorId }: { actorId: string }) {
  const business = await db().businesses.findUnique({
    where: { id: businessId },
    select: {
      published: true,
      created_at: true,
      branches: {
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
        take: 1,
        select: { id: true },
      },
      _count: { select: { products: { where: { deleted_at: null } } } },
    },
  });
  if (!business) throw new AppError("not_found", "No encontramos tu negocio.");
  const branch = business.branches[0];
  if (!branch) throw new AppError("no_branch", "Primero agrega tu sucursal (paso 1).");
  if (business._count.products === 0)
    throw new AppError("no_products", "Agrega al menos un producto antes de publicar (paso 3).");

  const hasQr = await db().qr_codes.count({
    where: { business_id: businessId, branch_id: branch.id, table_label: null },
  });
  if (hasQr === 0)
    await createQrCodes({ businessId, branchId: branch.id, kind: "branch" }, { actorId });

  if (!business.published) {
    await db().businesses.update({ where: { id: businessId }, data: { published: true } });
    await audit({
      actorId,
      actorKind: "user",
      businessId,
      action: "business.publish",
      entity: "businesses",
      entityId: businessId,
      diff: { minutes_to_publish: minutesToPublish(business.created_at, new Date()) },
    });
  }
}

/** Datos de la lista final (paso 4). */
export async function getChecklistData(businessId: string) {
  const [branch, products, bankAccounts, pushDevices, teamMembers] = await Promise.all([
    db().branches.findFirst({
      where: { business_id: businessId },
      orderBy: [{ sort: "asc" }, { created_at: "asc" }],
      select: { hours: { select: { weekday: true, opens: true, closes: true } } },
    }),
    db().products.count({ where: { business_id: businessId, deleted_at: null } }),
    db().bank_accounts.count({ where: { business_id: businessId } }),
    db().push_subscriptions.count({ where: { business_id: businessId } }),
    db().business_members.count({ where: { business_id: businessId, role: "manager" } }),
  ]);
  const standard = defaultWeek()
    .filter((d) => d.open)
    .map((d) => `${d.weekday} ${d.opens} ${d.closes}`)
    .join("|");
  const hours = (branch?.hours ?? [])
    .map((h) => `${h.weekday} ${h.opens} ${h.closes}`)
    .sort()
    .join("|");
  return {
    hoursCustomized: hours !== standard,
    products,
    bankAccounts,
    pushDevices,
    teamMembers,
  };
}
