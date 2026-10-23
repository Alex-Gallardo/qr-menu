/** Tipos de imagen del negocio: proporción, tamaño máximo y carpeta en Storage. */
export const IMAGE_KINDS = {
  product: { aspect: 4 / 3, maxSide: 1600, folder: "products", label: "foto del producto" },
  cover: { aspect: 16 / 9, maxSide: 1600, folder: "covers", label: "portada" },
  logo: { aspect: 1, maxSide: 800, folder: "logos", label: "logo" },
  /** Fondo de la página del menú (Apariencia). */
  background: { aspect: 16 / 9, maxSide: 1600, folder: "backgrounds", label: "fondo" },
  /** Fondo de la bienvenida: pantalla de celular vertical. */
  splash: { aspect: 9 / 16, maxSide: 1200, folder: "splash", label: "fondo de la bienvenida" },
} as const;

export type ImageKind = keyof typeof IMAGE_KINDS;

/** Meta de la guía: cada imagen subida pesa como máximo 300 KB. */
export const MAX_IMAGE_BYTES = 300 * 1024;
/** Archivo original más grande que aceptamos (fotos de celular de 8–12 MB pasan). */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Calidades que se prueban en orden hasta quedar bajo el límite. */
export const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5] as const;

/** Lado mayor ≤ maxSide conservando la proporción (nunca agranda). */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type EncodeFn = (size: { width: number; height: number }, quality: number) => Promise<Blob>;

/**
 * Busca la mejor calidad que quede bajo `maxBytes`: baja la calidad y, si no
 * alcanza, reduce el tamaño un 20 % y vuelve a probar (hasta 4 veces).
 * El encoder se inyecta para poder probarlo sin canvas.
 */
export async function encodeUnderLimit(
  start: { width: number; height: number },
  encode: EncodeFn,
  maxBytes = MAX_IMAGE_BYTES,
) {
  let size = start;
  let last: { blob: Blob; width: number; height: number; quality: number } | null = null;
  for (let round = 0; round < 4; round++) {
    for (const quality of QUALITY_STEPS) {
      const blob = await encode(size, quality);
      last = { blob, ...size, quality };
      if (blob.size <= maxBytes) return last;
    }
    size = { width: Math.round(size.width * 0.8), height: Math.round(size.height * 0.8) };
  }
  return last!;
}

/** Ruta en el bucket media: {negocio}/{carpeta}/{uuid}.{ext} */
export function mediaPath(businessId: string, kind: ImageKind, id: string, ext: "webp" | "jpg") {
  return `${businessId}/${IMAGE_KINDS[kind].folder}/${id}.${ext}`;
}

/** La ruta pertenece a ese negocio y a una carpeta válida (evita registrar archivos ajenos). */
export function isOwnMediaPath(path: string, businessId: string) {
  const folders = Object.values(IMAGE_KINDS)
    .map((k) => k.folder)
    .join("|");
  return new RegExp(`^${businessId}/(${folders})/[0-9a-f-]{36}\\.(webp|jpg)$`).test(path);
}

/** Video de fondo (guía §7): MP4 de máximo 6 MB y 10 s, siempre con poster. */
export const MAX_VIDEO_BYTES = 6 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 10;

export const videoPath = (businessId: string, id: string) => `${businessId}/videos/${id}.mp4`;

export function isOwnVideoPath(path: string, businessId: string) {
  return new RegExp(`^${businessId}/videos/[0-9a-f-]{36}\.mp4$`).test(path);
}
