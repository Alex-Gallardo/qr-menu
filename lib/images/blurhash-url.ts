import { decode, isBlurhashValid } from "blurhash";

/**
 * Blurhash → imagen diminuta (BMP de 8×6 en data URL, ~250 caracteres) para
 * `placeholder="blur"` de next/image. Se calcula en el servidor: el celular no
 * descarga la librería ni decodifica nada.
 */
export function blurhashToDataUrl(hash: string | null | undefined, width = 8, height = 6) {
  if (!hash || !isBlurhashValid(hash).result) return null;
  const pixels = decode(hash, width, height);
  const rowSize = Math.ceil((width * 3) / 4) * 4; // filas alineadas a 4 bytes
  const dataSize = rowSize * height;
  const buf = Buffer.alloc(54 + dataSize);

  buf.write("BM", 0, "ascii");
  buf.writeUInt32LE(54 + dataSize, 2);
  buf.writeUInt32LE(54, 10); // inicio de los píxeles
  buf.writeUInt32LE(40, 14); // BITMAPINFOHEADER
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22); // negativo = de arriba hacia abajo
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(dataSize, 34);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const o = 54 + y * rowSize + x * 3;
      buf[o] = pixels[i + 2]!; // B
      buf[o + 1] = pixels[i + 1]!; // G
      buf[o + 2] = pixels[i]!; // R
    }
  }
  return `data:image/bmp;base64,${buf.toString("base64")}`;
}
