import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  isBotUserAgent,
  isScannableCode,
  isShortCode,
  menuPath,
  newShortCode,
  qrKind,
  qrLink,
  tableRange,
} from "@/features/qr/codes";
import { darkRuns, inLogoBox, logoBox, qrColor, qrMatrix, qrSvg } from "@/features/qr/matrix";
import { moduleSizeMm, PRINT_LAYOUTS, printPage } from "@/features/qr/print";
import { buildPdf, PAGE_SIZES } from "@/lib/pdf/writer";

const LINK = "https://qr-menu-sooty-xi.vercel.app/q/Ab3dE7k";

describe("códigos y links", () => {
  it("códigos de 7 caracteres sin letras que se confunden", () => {
    for (let i = 0; i < 200; i++) {
      const code = newShortCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(isShortCode(code)).toBe(true);
      expect(code).not.toMatch(/[01OlI]/);
    }
    expect(isShortCode("Ab3dE7")).toBe(false);
    expect(isShortCode("Ab3dE70")).toBe(false);
    // Al escanear se aceptan también los códigos viejos del seed.
    expect(isScannableCode("demo01")).toBe(true);
    expect(isScannableCode("../../x")).toBe(false);
    expect(isScannableCode("a".repeat(40))).toBe(false);
  });

  it("sin sesgo: descarta los bytes que no caben parejo en el alfabeto", () => {
    let call = 0;
    // Primero bytes inválidos (≥ 224 con 56 letras), luego 0, 1, 2…
    const code = newShortCode((n) =>
      call++ === 0 ? new Uint8Array(n).fill(250) : Uint8Array.from({ length: n }, (_, i) => i),
    );
    expect(code).toBe(CODE_ALPHABET.slice(0, CODE_LENGTH));
  });

  it("link corto y menú con la mesa", () => {
    expect(qrLink("https://x.test/", "Ab3dE7k")).toBe("https://x.test/q/Ab3dE7k");
    expect(menuPath("cafe", "zona-1")).toBe("/cafe/zona-1");
    expect(menuPath("cafe", "zona-1", "4")).toBe("/cafe/zona-1?mesa=4");
    expect(menuPath("cafe", "zona-1", "Terraza 2")).toBe("/cafe/zona-1?mesa=Terraza%202");
  });

  it("rango de mesas", () => {
    expect(tableRange(1, 3)).toEqual(["1", "2", "3"]);
    expect(tableRange(3, 1)).toBeNull();
    expect(tableRange(0, 2)).toBeNull();
    expect(tableRange(1, 51)).toBeNull();
    expect(tableRange(1.5, 2)).toBeNull();
  });

  it("tipo del QR guardado", () => {
    expect(qrKind({ table_label: "4", style: null })).toBe("table");
    expect(qrKind({ table_label: null, style: { kind: "campaign" } })).toBe("campaign");
    expect(qrKind({ table_label: null, style: null })).toBe("branch");
  });

  it("vistas previas de enlaces y bots no cuentan como escaneo", () => {
    expect(isBotUserAgent("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });
});

describe("matriz y SVG", () => {
  const matrix = qrMatrix(LINK);

  it("nivel Q: el link corto entra en la versión 4 (33 módulos)", () => {
    expect(matrix.size).toBe(33);
    // Patrón de búsqueda arriba a la izquierda: borde oscuro y centro oscuro.
    expect(matrix.dark(0, 0) && matrix.dark(6, 6) && matrix.dark(3, 3)).toBe(true);
    expect(matrix.dark(1, 1)).toBe(false);
  });

  it("el logo tapa menos del 5 % y nunca los patrones de las esquinas", () => {
    const box = logoBox(matrix.size);
    expect(box.side % 2).toBe(1);
    expect((box.side * box.side) / (matrix.size * matrix.size)).toBeLessThan(0.05);
    expect(inLogoBox(box, 3, 3)).toBe(false);
    const withLogo = darkRuns(matrix, true).flatMap(([x, y, w]) =>
      Array.from({ length: w }, (_, i) => [x + i, y]),
    );
    expect(withLogo.some(([x, y]) => inLogoBox(box, x!, y!))).toBe(false);
  });

  it("los tramos reproducen exactamente los módulos oscuros", () => {
    let count = 0;
    for (let y = 0; y < matrix.size; y++)
      for (let x = 0; x < matrix.size; x++) if (matrix.dark(x, y)) count++;
    expect(darkRuns(matrix, false).reduce((n, [, , w]) => n + w, 0)).toBe(count);
  });

  it("color: el principal si se lee sobre blanco; si no, el texto o frijol", () => {
    expect(qrColor({ primary: "#D23B22", text: "#231A17" })).toBe("#D23B22");
    expect(qrColor({ primary: "#F2A541", text: "#F5EFE8" })).toBe("#231A17");
    expect(qrColor({ primary: "#F6E05E", text: "#102A35" })).toBe("#102A35");
  });

  it("SVG con margen, logo y texto escapado", () => {
    const svg = qrSvg({ matrix, color: "#D23B22", logo: { url: null, letter: "<c" } });
    expect(svg).toContain(`viewBox="0 0 41 41"`);
    expect(svg).toContain(`fill="#D23B22"`);
    expect(svg).toContain(">&lt;</text>");
    const withImage = qrSvg({
      matrix,
      color: "#111111",
      logo: { url: 'https://x.test/a.webp?a=1&b="2"', letter: "C" },
    });
    expect(withImage).toContain('href="https://x.test/a.webp?a=1&amp;b=&quot;2&quot;"');
  });
});

describe("impresión", () => {
  const matrix = qrMatrix(LINK);

  it("A6: el QR mide 88 mm y cada módulo más de 2 mm (escanea a 1 m)", () => {
    expect(PRINT_LAYOUTS.a6.qr.size).toBe(88);
    expect(moduleSizeMm("a6", matrix)).toBeGreaterThan(2);
    for (const format of ["a6", "carta"] as const) {
      const l = PRINT_LAYOUTS[format];
      expect(l.qr.x + l.qr.size).toBeLessThanOrEqual(l.width);
      expect(l.link.y).toBeLessThan(l.height);
      expect(l.qr.y + l.qr.size).toBeLessThan(l.label.y);
    }
  });

  it("PDF válido: cada objeto está donde dice la tabla xref", () => {
    const background = { jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1, height: 1 };
    const pages = (["a6", "carta"] as const).map((format) =>
      printPage({ format, matrix, color: "#D23B22", withLogo: true, background }),
    );
    const pdf = buildPdf(pages);
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);

    const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const entries = text.slice(xrefAt).match(/^(\d{10}) 00000 n $/gm)!;
    entries.forEach((entry, i) => {
      const offset = Number(entry.slice(0, 10));
      expect(text.startsWith(`${i + 1} 0 obj\n`, offset)).toBe(true);
    });
    expect(text).toContain("/Count 2");
    expect(text).toContain(`/MediaBox [0 0 ${PAGE_SIZES.carta.width} ${PAGE_SIZES.carta.height}]`);
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain("0.824 0.231 0.133 rg");
  });
});
