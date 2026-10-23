/**
 * PDF mínimo (1.4) sin dependencias: páginas con una imagen JPEG de fondo y
 * rectángulos de color encima. Basta para imprimir QR: los módulos van como
 * vectores (nítidos a cualquier tamaño) y el texto y el logo en la imagen.
 * Unidades en puntos (1 pt = 1/72 in); el origen es la esquina inferior izquierda.
 */

export type PdfImage = { jpeg: Uint8Array; width: number; height: number };

export type PdfRect = { x: number; y: number; w: number; h: number };

export type PdfPage = {
  width: number;
  height: number;
  /** Ocupa toda la página. */
  background?: PdfImage;
  /** Rectángulos rellenos con `color` (hex #RRGGBB). */
  rects?: { color: string; items: PdfRect[] };
};

export const MM = 72 / 25.4;
export const PAGE_SIZES = {
  a6: { width: 105 * MM, height: 148 * MM },
  carta: { width: 612, height: 792 },
} as const;

const ascii = (text: string) => new TextEncoder().encode(text);
const num = (n: number) => (Math.round(n * 1000) / 1000).toString();

function rgb(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => num(c / 255)).join(" ");
}

export function buildPdf(pages: PdfPage[]): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, parts: (string | Uint8Array)[]) => {
    offsets[id] = length;
    push(ascii(`${id} 0 obj\n`));
    for (const part of parts) push(typeof part === "string" ? ascii(part) : part);
    push(ascii("\nendobj\n"));
  };

  // 1 catálogo, 2 árbol de páginas; cada página usa 3 objetos: página, contenido, imagen.
  const pageId = (i: number) => 3 + i * 3;
  push(ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(2, [
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] >>`,
  ]);

  pages.forEach((page, i) => {
    const id = pageId(i);
    const imageId = id + 2;
    const ops: string[] = [];
    if (page.background) {
      ops.push(`q ${num(page.width)} 0 0 ${num(page.height)} 0 0 cm /Im0 Do Q`);
    }
    if (page.rects && page.rects.items.length > 0) {
      ops.push(`${rgb(page.rects.color)} rg`);
      for (const r of page.rects.items)
        ops.push(`${num(r.x)} ${num(r.y)} ${num(r.w)} ${num(r.h)} re`);
      ops.push("f");
    }
    const content = ascii(ops.join("\n"));
    const resources = page.background ? `/Resources << /XObject << /Im0 ${imageId} 0 R >> >>` : "";
    object(id, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] /Contents ${id + 1} 0 R ${resources} >>`,
    ]);
    object(id + 1, [`<< /Length ${content.length} >>\nstream\n`, content, "\nendstream"]);
    if (page.background) {
      const img = page.background;
      object(imageId, [
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`,
        img.jpeg,
        "\nendstream",
      ]);
    } else {
      // Objeto vacío para que la numeración siga siendo 3 por página.
      object(imageId, ["null"]);
    }
  });

  const count = 3 + pages.length * 3;
  const xref = length;
  const lines = ["xref", `0 ${count}`, "0000000000 65535 f "];
  for (let id = 1; id < count; id++)
    lines.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
  push(
    ascii(
      `${lines.join("\n")}\ntrailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    ),
  );

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
