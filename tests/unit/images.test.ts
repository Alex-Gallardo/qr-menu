import { describe, expect, it } from "vitest";
import {
  encodeUnderLimit,
  fitWithin,
  isOwnMediaPath,
  isOwnVideoPath,
  MAX_IMAGE_BYTES,
  mediaPath,
  videoPath,
} from "@/lib/images/presets";

const BIZ = "ef7f52a0-acbb-4db7-8071-7c5b91ebae12";
const ID = "0b8e3f1a-2c4d-4e6f-8a9b-1c2d3e4f5a6b";

describe("fitWithin", () => {
  it("reduce el lado mayor a 1600 px conservando la proporción", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("nunca agranda una imagen pequeña", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("encodeUnderLimit", () => {
  /** Encoder falso: el peso crece con el área y la calidad. */
  const fakeEncoder = (bytesPerPixelAtQ1: number) => {
    const calls: { width: number; height: number; quality: number }[] = [];
    const encode = async (size: { width: number; height: number }, quality: number) => {
      calls.push({ ...size, quality });
      return new Blob([
        new Uint8Array(Math.round(size.width * size.height * bytesPerPixelAtQ1 * quality)),
      ]);
    };
    return { encode, calls };
  };

  it("se queda con la primera calidad que cabe", async () => {
    const { encode, calls } = fakeEncoder(0.1);
    const r = await encodeUnderLimit({ width: 1600, height: 1200 }, encode);
    expect(r.blob.size).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
    expect(r.quality).toBe(0.82);
    expect(calls).toHaveLength(1);
  });

  it("baja la calidad y luego el tamaño hasta caber en 300 KB", async () => {
    const { encode, calls } = fakeEncoder(0.5);
    const r = await encodeUnderLimit({ width: 1600, height: 1200 }, encode);
    expect(r.blob.size).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
    expect(r.width).toBeLessThan(1600);
    expect(calls.map((c) => c.quality).slice(0, 5)).toEqual([0.82, 0.74, 0.66, 0.58, 0.5]);
  });
});

describe("rutas de Storage", () => {
  it("arma la ruta dentro de la carpeta del negocio", () => {
    expect(mediaPath(BIZ, "product", ID, "webp")).toBe(`${BIZ}/products/${ID}.webp`);
    expect(mediaPath(BIZ, "logo", ID, "jpg")).toBe(`${BIZ}/logos/${ID}.jpg`);
  });

  it("solo acepta rutas propias y bien formadas", () => {
    expect(isOwnMediaPath(`${BIZ}/covers/${ID}.webp`, BIZ)).toBe(true);
    expect(isOwnMediaPath(`otro-negocio/covers/${ID}.webp`, BIZ)).toBe(false);
    expect(isOwnMediaPath(`${BIZ}/../${ID}.webp`, BIZ)).toBe(false);
    expect(isOwnMediaPath(`${BIZ}/secretos/${ID}.webp`, BIZ)).toBe(false);
    expect(isOwnMediaPath(`${BIZ}/logos/${ID}.svg`, BIZ)).toBe(false);
    expect(isOwnMediaPath(`${BIZ}/backgrounds/${ID}.webp`, BIZ)).toBe(true);
    // Un video no se registra como imagen.
    expect(isOwnMediaPath(`${BIZ}/videos/${ID}.mp4`, BIZ)).toBe(false);
  });

  it("videos: solo MP4 en la carpeta de videos del negocio", () => {
    expect(videoPath(BIZ, ID)).toBe(`${BIZ}/videos/${ID}.mp4`);
    expect(isOwnVideoPath(`${BIZ}/videos/${ID}.mp4`, BIZ)).toBe(true);
    expect(isOwnVideoPath(`${BIZ}/videos/${ID}.mov`, BIZ)).toBe(false);
    expect(isOwnVideoPath(`${BIZ}/covers/${ID}.mp4`, BIZ)).toBe(false);
  });
});
