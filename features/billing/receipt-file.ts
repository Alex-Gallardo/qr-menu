"use client";

import { MAX_RECEIPT_BYTES } from "./schemas";

/**
 * Foto de la boleta → JPEG de hasta 1800 px (se lee bien y pesa poco); un
 * PDF va tal cual. Error con mensaje si no se puede usar.
 */
export async function prepareReceipt(file: File): Promise<Blob> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_RECEIPT_BYTES) throw new Error("El PDF pesa más de 8 MB.");
    return file;
  }
  if (!file.type.startsWith("image/")) throw new Error("Sube una foto (JPG, PNG) o un PDF.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("No pudimos leer la foto. Prueba con otra.");
    return blob;
  } finally {
    bitmap.close();
  }
}
