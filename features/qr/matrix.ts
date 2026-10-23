import QRCode from "qrcode";
import { contrastRatio } from "@/lib/color";

/**
 * Matriz y SVG del QR (puro). Nivel Q (recupera 25 %): aguanta el logo al
 * centro y el desgaste del papel, y con el link corto queda en versión 4
 * (33 módulos): en un A6 cada módulo mide ~2 mm y escanea a más de 1 m.
 */

export const QUIET_ZONE = 4;
const FRIJOL = "#231A17";

export type QrMatrix = { size: number; dark: (x: number, y: number) => boolean };

export function qrMatrix(text: string): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "Q" });
  return { size: modules.size, dark: (x, y) => Boolean(modules.get(y, x)) };
}

/** Color de los módulos: el principal del negocio si se lee sobre blanco; si no, su texto o frijol. */
export function qrColor(theme: { primary: string; text: string }) {
  for (const color of [theme.primary, theme.text]) {
    if (contrastRatio(color, "#FFFFFF") >= 4.5) return color.toUpperCase();
  }
  return FRIJOL;
}

/**
 * Caja del logo en módulos (impar, ~22 % del lado, centrada): cubre < 5 % del
 * área. Los módulos que quedan debajo no se dibujan.
 */
export function logoBox(size: number) {
  let side = Math.round(size * 0.22);
  if (side % 2 === 0) side += 1;
  const start = (size - side) / 2;
  return { start, side };
}

export const inLogoBox = (box: { start: number; side: number }, x: number, y: number) =>
  x >= box.start && x < box.start + box.side && y >= box.start && y < box.start + box.side;

/**
 * Tramos horizontales de módulos oscuros [x, y, largo] (sin los de la caja
 * del logo): menos rectángulos en el SVG y en el PDF.
 */
export function darkRuns(matrix: QrMatrix, withLogo: boolean): [number, number, number][] {
  const box = logoBox(matrix.size);
  const runs: [number, number, number][] = [];
  for (let y = 0; y < matrix.size; y++) {
    let start = -1;
    for (let x = 0; x <= matrix.size; x++) {
      const on = x < matrix.size && matrix.dark(x, y) && !(withLogo && inLogoBox(box, x, y));
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        runs.push([start, y, x - start]);
        start = -1;
      }
    }
  }
  return runs;
}

const escapeXml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

/**
 * SVG del QR con margen de 4 módulos. Con logo: recuadro blanco redondeado
 * al centro con la imagen (URL https) o la inicial del negocio.
 */
export function qrSvg({
  matrix,
  color,
  logo,
}: {
  matrix: QrMatrix;
  color: string;
  logo: { url: string | null; letter: string } | null;
}) {
  const total = matrix.size + QUIET_ZONE * 2;
  const path = darkRuns(matrix, Boolean(logo))
    .map(([x, y, w]) => `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h${w}v1h-${w}z`)
    .join("");
  let center = "";
  if (logo) {
    const box = logoBox(matrix.size);
    const pad = 0.5;
    const x = box.start + QUIET_ZONE + pad;
    const s = box.side - pad * 2;
    center =
      `<rect x="${x}" y="${x}" width="${s}" height="${s}" rx="${s * 0.22}" fill="#FFFFFF"/>` +
      (logo.url
        ? `<image href="${escapeXml(logo.url)}" x="${x + 0.4}" y="${x + 0.4}" width="${s - 0.8}" height="${s - 0.8}" preserveAspectRatio="xMidYMid slice"/>`
        : `<text x="${x + s / 2}" y="${x + s / 2}" dy="0.35em" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${s * 0.6}" fill="${color}">${escapeXml(logo.letter.slice(0, 1).toUpperCase())}</text>`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#FFFFFF"/>` +
    `<path d="${path}" fill="${color}"/>` +
    center +
    `</svg>`
  );
}
