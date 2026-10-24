import { fontClasses } from "@/features/appearance/font-loaders";
import { BODY_FONTS, fontStack, HEADING_FONTS, type FontName } from "@/features/appearance/fonts";
import { formatQ } from "@/lib/money";
import { Section } from "./section";

const CATALOG: { title: string; fonts: readonly { name: FontName }[]; sample: string }[] = [
  { title: "Títulos", fonts: HEADING_FONTS, sample: "Desayuno chapín" },
  { title: "Texto", fonts: BODY_FONTS, sample: "Huevos, frijoles, plátanos y crema. Q45.00" },
];

const SCALE = [
  { token: "display", cls: "type-display", spec: "40/1.05 → 64/1.0", use: "Hero landing" },
  { token: "h1", cls: "type-h1", spec: "30/1.15 → 40/1.1", use: "Nombre del negocio, títulos" },
  { token: "h2", cls: "type-h2", spec: "22/1.25 → 28/1.2", use: "Secciones del menú" },
  { token: "h3", cls: "type-h3", spec: "18/1.3 → 20/1.3", use: "Nombre de producto" },
  { token: "body", cls: "type-body", spec: "16/1.5 → 16/1.6", use: "Texto general, inputs" },
  { token: "small", cls: "type-small", spec: "14/1.45", use: "Descripciones de producto" },
  { token: "caption", cls: "type-caption", spec: "12/1.4", use: "Etiquetas, ayudas" },
] as const;

export function TypographySection() {
  return (
    <Section
      id="tipografia"
      number={3}
      title="Tipografía"
      description="Display: Bricolage Grotesque. UI y cuerpo: Inter, con cifras tabulares para precios. Ambas autohospedadas con next/font."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 shadow-1">
          <p className="type-caption text-muted-foreground">Display · Bricolage Grotesque</p>
          <p className="mt-2 font-display text-4xl font-bold">Aa Bb Cc 123</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-1">
          <p className="type-caption text-muted-foreground">UI · Inter</p>
          <p className="mt-2 text-4xl font-semibold">Aa Bb Cc 123</p>
        </div>
      </div>

      <div className="mt-6 divide-y divide-border rounded-lg border border-border bg-card shadow-1">
        {SCALE.map((s) => (
          <div key={s.token} className="grid gap-1 p-4 md:grid-cols-[160px_1fr] md:items-baseline">
            <div>
              <p className="font-mono text-sm font-semibold">{s.token}</p>
              <p className="type-caption text-muted-foreground">
                {s.spec} · {s.use}
              </p>
            </div>
            <p className={s.cls}>Tu menú del día</p>
          </div>
        ))}
        <div className="grid gap-1 p-4 md:grid-cols-[160px_1fr] md:items-baseline">
          <div>
            <p className="font-mono text-sm font-semibold">price</p>
            <p className="type-caption text-muted-foreground">16 semibold · cifras tabulares</p>
          </div>
          <div className="type-price flex flex-col items-start">
            <span>{formatQ(9000)}</span>
            <span>{formatQ(1800)}</span>
            <span>{formatQ(13100)}</span>
          </div>
        </div>
      </div>

      <h3 className="type-h3 mt-8">Catálogo para los menús (12 fuentes)</h3>
      <p className="type-small mt-1 max-w-prose text-muted-foreground">
        Cada negocio elige una de títulos y una de texto en Apariencia; el menú solo descarga esas
        dos.
      </p>
      <div
        className={`mt-4 grid gap-6 lg:grid-cols-2 ${fontClasses(...HEADING_FONTS.map((f) => f.name), ...BODY_FONTS.map((f) => f.name))}`}
      >
        {CATALOG.map((group) => (
          <div key={group.title} className="grid content-start gap-2">
            <p className="type-caption font-semibold tracking-wider text-muted-foreground uppercase">
              {group.title}
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card shadow-1">
              {group.fonts.map((f) => (
                <li key={f.name} className="grid gap-0.5 px-4 py-3">
                  <span className="type-caption text-muted-foreground">{f.name}</span>
                  <span
                    className={group.title === "Títulos" ? "text-2xl" : "text-base"}
                    style={{ fontFamily: fontStack(f.name) }}
                  >
                    {group.sample}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
