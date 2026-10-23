"use client";

import { buildPdf } from "@/lib/pdf/writer";
import { darkRuns, logoBox, QUIET_ZONE, qrMatrix, qrSvg, type QrMatrix } from "./matrix";
import { PRINT_LAYOUTS, printPage, type PrintFormat } from "./print";

/**
 * Descargas del QR en el navegador: PNG (canvas), SVG (texto) y PDF para
 * imprimir (fondo en canvas con textos y logo + módulos vectoriales).
 */

export type QrBrand = {
  businessName: string;
  logoUrl: string | null;
  color: string;
  /** Fuentes del negocio (nombres de familia, ya cargadas en la página). */
  headingFont: string;
  bodyFont: string;
};

export type QrItem = { link: string; label: string; fileName: string };

const PNG_SIZE = 1200;
/** Resolución del fondo impreso: suficiente para texto nítido sin pesar de más. */
const PRINT_DPI = 220;

/** El logo con CORS (el bucket de Storage lo permite); null si no se puede leer. */
async function loadLogo(url: string | null) {
  if (!url) return null;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, r);
  ctx.fill();
}

/** Recuadro blanco con el logo (o la inicial) en el centro del QR. */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  matrix: QrMatrix,
  origin: { x: number; y: number },
  cell: number,
  brand: QrBrand,
  logo: HTMLImageElement | null,
) {
  const box = logoBox(matrix.size);
  const pad = cell * 0.5;
  const offset = (QUIET_ZONE + box.start) * cell + pad;
  const x = origin.x + offset;
  const y = origin.y + offset;
  const s = box.side * cell - pad * 2;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, s, s * 0.22);
  const inner = s - cell * 0.8;
  const ix = x + (s - inner) / 2;
  const iy = y + (s - inner) / 2;
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(ix, iy, inner, inner, inner * 0.2);
    ctx.clip();
    // Recorte centrado ("cover").
    const scale = Math.max(inner / logo.naturalWidth, inner / logo.naturalHeight);
    const w = logo.naturalWidth * scale;
    const h = logo.naturalHeight * scale;
    ctx.drawImage(logo, ix + (inner - w) / 2, iy + (inner - h) / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = brand.color;
    ctx.font = `700 ${s * 0.6}px ${brand.headingFont}, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brand.businessName.slice(0, 1).toUpperCase(), x + s / 2, y + s / 2 + s * 0.04);
  }
}

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = Math.round(width);
  c.height = Math.round(height);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, c.width, c.height);
  return { c, ctx };
}

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))),
      type,
      quality,
    ),
  );

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PNG de 1200 px (redes, WhatsApp, imprimir en otro programa). */
export async function qrPng(item: QrItem, brand: QrBrand) {
  const matrix = qrMatrix(item.link);
  const cell = PNG_SIZE / (matrix.size + QUIET_ZONE * 2);
  const { c, ctx } = canvas(PNG_SIZE, PNG_SIZE);
  ctx.fillStyle = brand.color;
  for (const [x, y, w] of darkRuns(matrix, true))
    ctx.fillRect((x + QUIET_ZONE) * cell, (y + QUIET_ZONE) * cell, w * cell + 0.5, cell + 0.5);
  drawLogo(ctx, matrix, { x: 0, y: 0 }, cell, brand, await loadLogo(brand.logoUrl));
  return toBlob(c, "image/png");
}

/** SVG vectorial (imprentas). El logo va como enlace a la imagen pública. */
export function qrSvgBlob(item: QrItem, brand: QrBrand) {
  const svg = qrSvg({
    matrix: qrMatrix(item.link),
    color: brand.color,
    logo: { url: brand.logoUrl, letter: brand.businessName },
  });
  return new Blob([svg], { type: "image/svg+xml" });
}

/** Fondo de una página impresa: nombre, "Escanea y pide", logo al centro del QR, mesa y link. */
async function printBackground(
  format: PrintFormat,
  item: QrItem,
  matrix: QrMatrix,
  brand: QrBrand,
  logo: HTMLImageElement | null,
) {
  const layout = PRINT_LAYOUTS[format];
  const px = PRINT_DPI / 25.4;
  const { c, ctx } = canvas(layout.width * px, layout.height * px);
  const center = c.width / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // pt → px: 1 pt = 25.4/72 mm.
  const font = (weight: number, sizePt: number, family: string) =>
    `${weight} ${sizePt * (25.4 / 72) * px}px ${family}, sans-serif`;
  const fit = (text: string, max: number) => {
    let t = text;
    while (ctx.measureText(t).width > max && t.length > 4) t = `${t.slice(0, -2)}…`;
    return t;
  };
  const maxWidth = c.width - 12 * px;

  ctx.fillStyle = brand.color;
  ctx.font = font(700, layout.title.size, brand.headingFont);
  ctx.fillText(fit(brand.businessName, maxWidth), center, layout.title.y * px);

  ctx.fillStyle = "#231A17";
  ctx.font = font(600, layout.subtitle.size, brand.bodyFont);
  ctx.fillText("Escanea y pide 📱", center, layout.subtitle.y * px);

  const cell = (layout.qr.size / (matrix.size + QUIET_ZONE * 2)) * px;
  drawLogo(ctx, matrix, { x: layout.qr.x * px, y: layout.qr.y * px }, cell, brand, logo);

  ctx.fillStyle = "#231A17";
  ctx.font = font(700, layout.label.size, brand.headingFont);
  ctx.fillText(fit(item.label, maxWidth), center, layout.label.y * px);

  ctx.fillStyle = "#6B5F58";
  ctx.font = font(500, layout.footer.size, brand.bodyFont);
  ctx.fillText("Menú del día · Pedidos por WhatsApp", center, layout.footer.y * px);
  ctx.font = font(500, layout.link.size, brand.bodyFont);
  ctx.fillText(item.link.replace(/^https?:\/\//, ""), center, layout.link.y * px);

  const jpeg = new Uint8Array(await (await toBlob(c, "image/jpeg", 0.92)).arrayBuffer());
  return { jpeg, width: c.width, height: c.height };
}

/** PDF listo para imprimir: una página por QR (A6 para la mesa o carta). */
export async function qrPdf(items: QrItem[], format: PrintFormat, brand: QrBrand) {
  await Promise.all([
    document.fonts.load(`700 20px ${brand.headingFont}`),
    document.fonts.load(`600 20px ${brand.bodyFont}`),
  ]).catch(() => {});
  const logo = await loadLogo(brand.logoUrl);
  const pages = [];
  for (const item of items) {
    const matrix = qrMatrix(item.link);
    const background = await printBackground(format, item, matrix, brand, logo);
    pages.push(printPage({ format, matrix, color: brand.color, withLogo: true, background }));
  }
  return new Blob([buildPdf(pages)], { type: "application/pdf" });
}
