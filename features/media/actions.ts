"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { actionError, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { requireAccess } from "@/lib/auth/require-access";
import { tags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { ImageKind } from "@/lib/images/presets";
import {
  deleteOwnMediaByUrl,
  isRegisteredMediaUrl,
  registerUploadedImage,
  registerUploadedVideo,
  signImageUpload,
  signVideoUpload,
} from "./server";

const kindSchema = z.enum(["product", "cover", "logo", "background", "splash"]);

/** Logo, portada y fondos son de Apariencia (solo dueño); fotos de producto también el encargado. */
function rolesFor(kind: ImageKind) {
  return kind === "product" ? (["owner", "manager"] as const) : (["owner"] as const);
}

const startSchema = z.object({
  businessId: z.uuid(),
  kind: kindSchema,
  bytes: z.number().int().positive(),
  ext: z.enum(["webp", "jpg", "png"]),
});

export async function createImageUpload(
  input: unknown,
): Promise<ActionResult<{ signedUrl: string; path: string }>> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos preparar la foto." };
  const { businessId, kind, bytes, ext } = parsed.data;
  try {
    await requireAccess(businessId, { roles: [...rolesFor(kind)], write: true });
    return { ok: true, data: await signImageUpload(businessId, kind, bytes, ext) };
  } catch (error) {
    return actionError(error);
  }
}

const registerSchema = z.object({
  businessId: z.uuid(),
  kind: kindSchema,
  path: z.string().max(200),
  width: z.number().int().positive().max(4000),
  height: z.number().int().positive().max(4000),
  blurhash: z.string().min(6).max(100),
});

export async function registerImage(
  input: unknown,
): Promise<ActionResult<{ id: string; url: string; blurhash: string | null }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos guardar la foto." };
  const { kind, ...data } = parsed.data;
  try {
    await requireAccess(data.businessId, { roles: [...rolesFor(kind)], write: true });
    const media = await registerUploadedImage(data);
    return { ok: true, data: { id: media.id, url: media.url, blurhash: media.blurhash } };
  } catch (error) {
    return actionError(error);
  }
}

const businessImageSchema = z.object({
  businessId: z.uuid(),
  field: z.enum(["logo_url", "cover_url"]),
  url: z.url().nullable(),
});

/** Asigna (o quita) el logo o la portada del negocio y borra la imagen anterior. */
export async function setBusinessImage(input: unknown): Promise<ActionResult> {
  const parsed = businessImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos guardar la imagen." };
  const { businessId, field, url } = parsed.data;
  try {
    const { user } = await requireAccess(businessId, { roles: ["owner"], write: true });
    const before = await db().businesses.findUnique({
      where: { id: businessId },
      select: { logo_url: true, cover_url: true },
    });
    if (!before) throw new AppError("not_found", "No encontramos tu negocio.");
    const previous = before[field];

    // Solo URLs de nuestro bucket registradas para este negocio.
    if (url && !(await isRegisteredMediaUrl(businessId, url))) {
      throw new AppError("forbidden", "Esa imagen no es de tu negocio.");
    }

    await db().businesses.update({ where: { id: businessId }, data: { [field]: url } });
    if (previous && previous !== url) await deleteOwnMediaByUrl(businessId, previous);
    await audit({
      actorId: user.id,
      actorKind: "user",
      businessId,
      action: "business.update",
      entity: "businesses",
      entityId: businessId,
      diff: { [field]: [previous ? "imagen anterior" : null, url ? "imagen nueva" : null] },
    });
    updateTag(tags.business(businessId));
    return { ok: true, message: url ? "¡Listo! Guardamos la imagen." : "Quitamos la imagen." };
  } catch (error) {
    return actionError(error);
  }
}

const videoStartSchema = z.object({
  businessId: z.uuid(),
  bytes: z.number().int().positive(),
});

/** Video de fondo (Apariencia): solo el dueño y con "video_bg" en el plan. */
export async function createVideoUpload(
  input: unknown,
): Promise<ActionResult<{ signedUrl: string; path: string }>> {
  const parsed = videoStartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos preparar el video." };
  const { businessId, bytes } = parsed.data;
  try {
    await requireAccess(businessId, { roles: ["owner"], feature: "video_bg", write: true });
    return { ok: true, data: await signVideoUpload(businessId, bytes) };
  } catch (error) {
    return actionError(error);
  }
}

const videoRegisterSchema = z.object({
  businessId: z.uuid(),
  path: z.string().max(200),
  width: z.number().int().positive().max(4000),
  height: z.number().int().positive().max(4000),
});

export async function registerVideo(
  input: unknown,
): Promise<ActionResult<{ id: string; url: string }>> {
  const parsed = videoRegisterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos guardar el video." };
  try {
    await requireAccess(parsed.data.businessId, {
      roles: ["owner"],
      feature: "video_bg",
      write: true,
    });
    return { ok: true, data: await registerUploadedVideo(parsed.data) };
  } catch (error) {
    return actionError(error);
  }
}
