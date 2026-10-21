import { encode as encodeBlurhash } from "blurhash";
import { clientEnv } from "@/lib/env.client";
import { encodeUnderLimit, fitWithin, IMAGE_KINDS, type ImageKind } from "./presets";

export type CropArea = { x: number; y: number; width: number; height: number };

export type CompressedImage = {
  blob: Blob;
  ext: "webp" | "jpg";
  width: number;
  height: number;
  blurhash: string;
};

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))),
      type,
      quality,
    ),
  );
}

/**
 * Recorta y comprime en el navegador: WebP (o JPEG si el navegador no codifica
 * WebP), lado mayor ≤ 1600 px y ≤ 300 KB, más un blurhash para mostrar mientras carga.
 */
export async function compressImage(
  file: Blob,
  crop: CropArea,
  kind: ImageKind,
): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const start = fitWithin(crop.width, crop.height, IMAGE_KINDS[kind].maxSide);

    const draw = (size: { width: number; height: number }) => {
      const canvas = makeCanvas(size.width, size.height);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height);
      return canvas;
    };

    // Safari antiguo devuelve PNG si no sabe codificar WebP: se detecta y se usa JPEG.
    const probe = await toBlob(draw({ width: 8, height: 8 }), "image/webp", 0.8);
    const webp = probe.type === "image/webp";
    const type = webp ? "image/webp" : "image/jpeg";

    const result = await encodeUnderLimit(start, (size, quality) =>
      toBlob(draw(size), type, quality),
    );

    // Blurhash con una miniatura de 32 px de ancho.
    const thumb = fitWithin(result.width, result.height, 32);
    const small = draw(thumb);
    const pixels = small.getContext("2d")!.getImageData(0, 0, thumb.width, thumb.height);
    const blurhash = encodeBlurhash(pixels.data, thumb.width, thumb.height, 4, 3);

    return {
      blob: result.blob,
      ext: webp ? "webp" : "jpg",
      width: result.width,
      height: result.height,
      blurhash,
    };
  } finally {
    bitmap.close();
  }
}

/** PUT al URL firmado de Storage con progreso real (fetch no lo reporta al subir). */
export function uploadWithProgress(
  url: string,
  blob: Blob,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // El gateway de Supabase pide la llave pública; el token del URL autoriza la escritura.
    xhr.setRequestHeader("apikey", clientEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY);
    xhr.setRequestHeader("content-type", blob.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage respondió ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Se fue el internet durante la subida."));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.onabort = () => reject(new DOMException("Subida cancelada", "AbortError"));
    xhr.send(blob);
  });
}
