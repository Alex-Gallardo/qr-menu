import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE, type AppearanceDoc } from "@/features/appearance/appearance";
import { appearanceSchema } from "@/features/appearance/schemas";
import {
  getAppearanceDoc,
  getAppearancePage,
  updateAppearance,
} from "@/features/appearance/server";
import { publicMediaUrl } from "@/features/media/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { mediaPath } from "@/lib/images/presets";

/** QRM-033: Apariencia guardada con los límites del plan y sus imágenes. */

const DAY = 24 * 60 * 60 * 1000;
const FREE = "zz-test-qrm033-gratis";
const PRO = "zz-test-qrm033-pro";
let freeId: string;
let proId: string;
let actorId: string;

async function tempBusiness(slug: string, plan_id: string) {
  const biz = await db().businesses.create({
    data: {
      slug,
      name: `Prueba ${plan_id}`,
      license: { create: { plan_id, status: "active", ends_at: new Date(Date.now() + 30 * DAY) } },
      branches: { create: { slug: "centro", name: "Centro", whatsapp_e164: "+50255550000" } },
      products: { create: { name: "Pepián", price_cents: 6500 } },
    },
    select: { id: true },
  });
  return biz.id;
}

const doc = (over: Partial<AppearanceDoc>): AppearanceDoc => ({ ...DEFAULT_APPEARANCE, ...over });

/** Error de la plataforma con su código, o null si no lanzó. */
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => (e instanceof AppError ? e.code : String(e)),
  );

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [FREE, PRO] } } });
  freeId = await tempBusiness(FREE, "gratis");
  proId = await tempBusiness(PRO, "pro");
  const owner = await db().business_members.findFirst({ where: { role: "owner" } });
  if (!owner) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  actorId = owner.user_id;
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [FREE, PRO] } } });
  // audit_logs no tiene FK (la auditoría sobrevive al negocio): se borran a mano.
  await db().audit_logs.deleteMany({ where: { business_id: { in: [freeId, proId] } } });
  await db().$disconnect();
});

describe("apariencia", () => {
  it("sin fila en themes, el editor arranca con los valores por defecto", async () => {
    expect(await getAppearanceDoc(freeId)).toEqual(DEFAULT_APPEARANCE);
    const page = await getAppearancePage(freeId);
    expect(page?.business.branch?.slug).toBe("centro");
    expect(page?.business.products.map((p) => p.name)).toEqual(["Pepián"]);
  });

  it("plan Gratis: paleta lista, fuentes y bordes sí (con los colores exactos de la lista)", async () => {
    await updateAppearance(
      freeId,
      doc({ palette_preset: "mar", color_primary: "#000000", font_heading: "Fraunces", radius: 8 }),
      { actorId },
    );
    const saved = await getAppearanceDoc(freeId);
    expect(saved.color_primary).toBe("#1F6F8B");
    expect(saved.font_heading).toBe("Fraunces");
    expect(saved.radius).toBe(8);
    const logs = await db().audit_logs.count({
      where: { business_id: freeId, action: "theme.update" },
    });
    expect(logs).toBe(1);
  });

  it("plan Gratis: paleta personalizada, bienvenida y quitar la marca se rechazan", async () => {
    const base = await getAppearanceDoc(freeId);
    expect(
      await failure(
        updateAppearance(
          freeId,
          { ...base, palette_preset: "custom", color_primary: "#123456" },
          {
            actorId,
          },
        ),
      ),
    ).toBe("feature_unavailable");
    expect(
      await failure(updateAppearance(freeId, { ...base, splash_style: "zoom" }, { actorId })),
    ).toBe("feature_unavailable");
    expect(
      await failure(updateAppearance(freeId, { ...base, show_powered_by: false }, { actorId })),
    ).toBe("feature_unavailable");
    expect((await getAppearanceDoc(freeId)).palette_preset).toBe("mar");
  });

  it("plan Pro: paleta personalizada y bienvenida configurable se guardan", async () => {
    await updateAppearance(
      proId,
      doc({
        palette_preset: "custom",
        color_primary: "#123456",
        splash_style: "fade",
        splash_tagline: "  Desde 1998  ",
      }),
      { actorId },
    );
    const saved = await getAppearanceDoc(proId);
    expect(saved.color_primary).toBe("#123456");
    expect(saved.splash_style).toBe("fade");
    expect(saved.splash_tagline).toBe("Desde 1998");
  });

  it("si baja a Gratis, puede seguir cambiando lo demás sin perder su paleta", async () => {
    await db().licenses.update({ where: { business_id: proId }, data: { plan_id: "gratis" } });
    const base = await getAppearanceDoc(proId);
    await updateAppearance(proId, { ...base, radius: 4 }, { actorId });
    const saved = await getAppearanceDoc(proId);
    expect(saved.radius).toBe(4);
    expect(saved.color_primary).toBe("#123456");
    await db().licenses.update({ where: { business_id: proId }, data: { plan_id: "pro" } });
  });

  it("fondo con imagen: solo archivos registrados del negocio; al cambiar se borra la anterior", async () => {
    const base = await getAppearanceDoc(proId);
    const foreign = publicMediaUrl(mediaPath(freeId, "background", randomUUID(), "webp"));
    expect(
      await failure(
        updateAppearance(proId, { ...base, bg_type: "image", bg_value: foreign }, { actorId }),
      ),
    ).toBe("forbidden");

    const path = mediaPath(proId, "background", randomUUID(), "webp");
    await db().media.create({ data: { business_id: proId, path, kind: "image", bytes: 1000 } });
    const own = publicMediaUrl(path);
    await updateAppearance(proId, { ...base, bg_type: "image", bg_value: own }, { actorId });
    expect((await getAppearanceDoc(proId)).bg_value).toBe(own);

    await updateAppearance(proId, { ...base, bg_type: "color", bg_value: null }, { actorId });
    expect(await db().media.count({ where: { business_id: proId, path } })).toBe(0);
  });

  it("el esquema rechaza fuentes fuera del catálogo y fondos incompletos", () => {
    const input = { ...DEFAULT_APPEARANCE, businessId: proId };
    expect(appearanceSchema.safeParse(input).success).toBe(true);
    expect(appearanceSchema.safeParse({ ...input, font_body: "Comic Sans" }).success).toBe(false);
    expect(appearanceSchema.safeParse({ ...input, bg_type: "gradient" }).success).toBe(false);
    expect(
      appearanceSchema.safeParse({ ...input, bg_type: "image", bg_value: "http://x.test/a.webp" })
        .success,
    ).toBe(false);
  });
});
