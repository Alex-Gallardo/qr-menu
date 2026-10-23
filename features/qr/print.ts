import { MM, PAGE_SIZES, type PdfImage, type PdfPage } from "@/lib/pdf/writer";
import { darkRuns, QUIET_ZONE, type QrMatrix } from "./matrix";

/**
 * Diseño de impresión (puro). Medidas en mm desde la esquina superior
 * izquierda; `y` de los textos es su línea base. A6 es el porta-QR de mesa;
 * carta, para la puerta o la caja.
 */

export type PrintFormat = keyof typeof PAGE_SIZES;

type TextSlot = { y: number; size: number };

export type PrintLayout = {
  width: number;
  height: number;
  /** El cuadro del QR incluye el margen blanco de 4 módulos. */
  qr: { x: number; y: number; size: number };
  title: TextSlot;
  subtitle: TextSlot;
  label: TextSlot;
  footer: TextSlot;
  link: TextSlot;
};

const mm = (pt: number) => pt / MM;

export const PRINT_LAYOUTS: Record<PrintFormat, PrintLayout> = {
  a6: {
    width: mm(PAGE_SIZES.a6.width),
    height: mm(PAGE_SIZES.a6.height),
    title: { y: 16, size: 15 },
    subtitle: { y: 24, size: 11 },
    qr: { x: (105 - 88) / 2, y: 29, size: 88 },
    label: { y: 128, size: 17 },
    footer: { y: 137, size: 8.5 },
    link: { y: 143, size: 7.5 },
  },
  carta: {
    width: mm(PAGE_SIZES.carta.width),
    height: mm(PAGE_SIZES.carta.height),
    title: { y: 32, size: 28 },
    subtitle: { y: 46, size: 20 },
    qr: { x: (215.9 - 150) / 2, y: 58, size: 150 },
    label: { y: 228, size: 32 },
    footer: { y: 245, size: 15 },
    link: { y: 258, size: 13 },
  },
};

/** Tamaño de cada módulo impreso en mm (el criterio pide escanear un A6 a 1 m). */
export const moduleSizeMm = (format: PrintFormat, matrix: QrMatrix) =>
  PRINT_LAYOUTS[format].qr.size / (matrix.size + QUIET_ZONE * 2);

/**
 * Página del PDF: la imagen de fondo (textos y logo, dibujados en canvas) y
 * los módulos del QR como rectángulos vectoriales encima.
 */
export function printPage({
  format,
  matrix,
  color,
  withLogo,
  background,
}: {
  format: PrintFormat;
  matrix: QrMatrix;
  color: string;
  withLogo: boolean;
  background: PdfImage;
}): PdfPage {
  const layout = PRINT_LAYOUTS[format];
  const page = PAGE_SIZES[format];
  const cell = moduleSizeMm(format, matrix) * MM;
  const left = layout.qr.x * MM + QUIET_ZONE * cell;
  const top = layout.qr.y * MM + QUIET_ZONE * cell;
  return {
    width: page.width,
    height: page.height,
    background,
    rects: {
      color,
      items: darkRuns(matrix, withLogo).map(([x, y, w]) => ({
        x: left + x * cell,
        // PDF mide desde abajo. +0.05 pt de traslape: sin líneas blancas entre filas al imprimir.
        y: page.height - (top + (y + 1) * cell) - 0.05,
        w: w * cell,
        h: cell + 0.05,
      })),
    },
  };
}
