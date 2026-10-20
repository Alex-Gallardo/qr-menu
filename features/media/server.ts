import "server-only";
import { randomUUID } from "node:crypto";
import { assertWithinLimit } from "@/features/licensing/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { isOwnMediaPath, MAX_IMAGE_BYTES, mediaPath, type ImageKind } from "@/lib/images/presets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "media";
const MB = 1024 * 1024;

export function publicMediaUrl(path: string) {
  return createSupabaseAdminClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** URL firmada (2 h) para subir directo a Storage desde el navegador. */
export async function signImageUpload(
  businessId: string,
  kind: ImageKind,
  bytes: number,
  ext: "webp" | "jpg",
) {
  if (bytes > MAX_IMAGE_BYTES * 1.1) {
    throw new AppError("too_large", "La foto quedó muy pesada. Prueba con otra o recórtala más.");
  }
  await assertWithinLimit(businessId, "storage_mb", Math.max(1, Math.ceil(bytes / MB)));
  const path = mediaPath(businessId, kind, randomUUID(), ext);
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data)
    throw new AppError("storage", "No pudimos preparar la subida. Probemos otra vez.");
  return { signedUrl: data.signedUrl, path };
}

/** Registra la imagen ya subida: confirma que existe y usa el tamaño real de Storage. */
export async function registerUploadedImage(input: {
  businessId: string;
  path: string;
  width: number;
  height: number;
  blurhash: string;
}) {
  if (!isOwnMediaPath(input.path, input.businessId)) {
    throw new AppError("forbidden", "Esa imagen no es de tu negocio.");
  }
  const storage = createSupabaseAdminClient().storage.from(BUCKET);
  const { data: info, error } = await storage.info(input.path);
  if (error || !info)
    throw new AppError("not_found", "No encontramos la foto subida. Probemos otra vez.");

  const bytes = Number(info.size ?? 0);
  if (bytes > MAX_IMAGE_BYTES * 1.1) {
    await storage.remove([input.path]);
    throw new AppError("too_large", "La foto quedó muy pesada. Prueba con otra o recórtala más.");
  }

  const media = await db().media.create({
    data: {
      business_id: input.businessId,
      path: input.path,
      kind: "image",
      width: input.width,
      height: input.height,
      bytes,
      blurhash: input.blurhash,
    },
    select: { id: true, path: true, blurhash: true, bytes: true },
  });
  return { ...media, url: publicMediaUrl(media.path) };
}

/** Ruta dentro del bucket si la URL pública es nuestra y de ese negocio; si no, null. */
export function ownMediaPathFromUrl(businessId: string, url: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null; // p. ej. fotos de Unsplash del seed
  const path = decodeURIComponent(url.slice(index + marker.length));
  return isOwnMediaPath(path, businessId) ? path : null;
}

/** ¿La URL apunta a una imagen registrada de este negocio? */
export async function isRegisteredMediaUrl(businessId: string, url: string) {
  const path = ownMediaPathFromUrl(businessId, url);
  if (!path) return false;
  const row = await db().media.findFirst({
    where: { business_id: businessId, path },
    select: { id: true },
  });
  return Boolean(row);
}

/** Si la URL es de nuestro bucket y de este negocio, borra el archivo y su fila en media. */
export async function deleteOwnMediaByUrl(businessId: string, url: string | null) {
  if (!url) return;
  const path = ownMediaPathFromUrl(businessId, url);
  if (!path) return;
  await createSupabaseAdminClient().storage.from(BUCKET).remove([path]);
  await db().media.deleteMany({ where: { business_id: businessId, path } });
}
