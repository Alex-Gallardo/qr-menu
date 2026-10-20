import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteOwnMediaByUrl,
  isRegisteredMediaUrl,
  registerUploadedImage,
  signImageUpload,
} from "@/features/media/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { MAX_IMAGE_BYTES } from "@/lib/images/presets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** QRM-013: URL firmada → PUT directo a Storage → registro con el tamaño real. */

const SLUG = "zz-test-qrm013";
let businessId: string;

/** Lo mismo que hace uploadWithProgress en el navegador, con fetch. */
async function put(signedUrl: string, bytes: number) {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "content-type": "image/webp",
      "x-upsert": "false",
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) throw new Error(`PUT ${res.status}: ${await res.text()}`);
}

async function cleanStorage() {
  if (!businessId) return;
  const storage = createSupabaseAdminClient().storage.from("media");
  for (const folder of ["products", "covers", "logos"]) {
    const { data } = await storage.list(`${businessId}/${folder}`);
    const paths = (data ?? []).map((f) => `${businessId}/${folder}/${f.name}`);
    if (paths.length) await storage.remove(paths);
  }
}

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  const biz = await db().businesses.create({
    data: { slug: SLUG, name: "Prueba QRM-013" },
    select: { id: true },
  });
  businessId = biz.id;
});

afterAll(async () => {
  await cleanStorage();
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().$disconnect();
});

describe("subida de imágenes", () => {
  it("sube con URL firmada y registra el peso real", async () => {
    const { signedUrl, path } = await signImageUpload(businessId, "cover", 120_000, "webp");
    expect(path).toMatch(new RegExp(`^${businessId}/covers/[0-9a-f-]{36}\\.webp$`));
    await put(signedUrl, 120_000);

    const media = await registerUploadedImage({
      businessId,
      path,
      width: 1600,
      height: 900,
      blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
    });
    expect(media.bytes).toBe(120_000);
    expect(media.url).toContain(`/storage/v1/object/public/media/${path}`);
    expect(await isRegisteredMediaUrl(businessId, media.url)).toBe(true);

    // La URL pública responde sin sesión.
    const res = await fetch(media.url, { method: "HEAD" });
    expect(res.status).toBe(200);

    await deleteOwnMediaByUrl(businessId, media.url);
    expect(await isRegisteredMediaUrl(businessId, media.url)).toBe(false);
    const gone = await createSupabaseAdminClient().storage.from("media").info(path);
    expect(gone.data).toBeNull();
  });

  it("rechaza pedir subidas de más de 300 KB", async () => {
    await expect(signImageUpload(businessId, "product", 2_000_000, "webp")).rejects.toThrow(
      AppError,
    );
  });

  it("si lo subido pesa de más, lo borra y no lo registra", async () => {
    const { signedUrl, path } = await signImageUpload(businessId, "product", 200_000, "webp");
    await put(signedUrl, Math.round(MAX_IMAGE_BYTES * 1.5)); // el cliente mintió el tamaño
    await expect(
      registerUploadedImage({ businessId, path, width: 10, height: 10, blurhash: "LEHV6nWB2y" }),
    ).rejects.toThrow(AppError);
    expect(await db().media.count({ where: { business_id: businessId } })).toBe(0);
    const info = await createSupabaseAdminClient().storage.from("media").info(path);
    expect(info.data).toBeNull();
  });

  it("no registra rutas de otro negocio ni URLs ajenas", async () => {
    const other = "11111111-2222-4333-8444-555555555555";
    await expect(
      registerUploadedImage({
        businessId,
        path: `${other}/logos/0b8e3f1a-2c4d-4e6f-8a9b-1c2d3e4f5a6b.webp`,
        width: 10,
        height: 10,
        blurhash: "LEHV6nWB2y",
      }),
    ).rejects.toThrow(AppError);
    expect(await isRegisteredMediaUrl(businessId, "https://images.unsplash.com/photo-1")).toBe(
      false,
    );
  });
});
