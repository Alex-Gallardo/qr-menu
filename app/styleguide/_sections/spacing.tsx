import { Section } from "./section";
import { CurrentBreakpoint } from "./spacing-demo";

const SPACE = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const;

const CONTAINERS = [
  { token: "max-w-menu", px: 480, use: "Menú público, hojas, login" },
  { token: "max-w-landing", px: 1200, use: "Landing, panel, styleguide" },
] as const;

const BREAKPOINTS = [
  { token: "base", px: 0, use: "Celular (diseño principal, 360–430)" },
  { token: "sm", px: 640, use: "Celular grande en horizontal" },
  { token: "md", px: 768, use: "Tablet: la escala tipográfica crece" },
  { token: "lg", px: 1024, use: "Panel con barra lateral" },
  { token: "xl", px: 1280, use: "Escritorio amplio" },
] as const;

export function SpacingSection() {
  return (
    <Section
      id="espaciado"
      number={4}
      title="Espaciado y grilla"
      description="Escala de 4 px (las clases de Tailwind: 1 = 4 px). Dos contenedores: 480 px para lo que se usa con el pulgar y 1200 px para pantallas grandes. Márgenes laterales de 16 px en móvil."
    >
      <div className="grid gap-2 rounded-lg border border-border bg-card p-4 shadow-1">
        {SPACE.map((s) => (
          <div key={s} className="flex items-center gap-3">
            <span className="type-caption w-20 shrink-0 font-mono">
              {s} · {s * 4} px
            </span>
            <span className="h-3 rounded-sm bg-primary" style={{ width: s * 4 }} />
          </div>
        ))}
      </div>

      <h3 className="type-h3 mt-8">Contenedores</h3>
      <div className="mt-4 grid gap-3">
        {CONTAINERS.map((c) => (
          <div key={c.token} className="grid gap-1">
            <p className="type-caption">
              <span className="font-mono font-semibold">{c.token}</span> · {c.px} px · {c.use}
            </p>
            <div
              className="h-10 rounded-md border-2 border-dashed border-primary/50 bg-primary/5"
              style={{ maxWidth: c.px }}
            />
          </div>
        ))}
      </div>

      <h3 className="type-h3 mt-8">Breakpoints</h3>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card shadow-1">
        <table className="type-small w-full min-w-[28rem] text-left">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3 font-semibold">Token</th>
              <th className="p-3 font-semibold">Desde</th>
              <th className="p-3 font-semibold">Uso</th>
            </tr>
          </thead>
          <tbody>
            {BREAKPOINTS.map((b) => (
              <tr key={b.token} className="border-b border-border last:border-0">
                <td className="p-3 font-mono">{b.token}</td>
                <td className="p-3 tabular-nums">{b.px} px</td>
                <td className="p-3">{b.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CurrentBreakpoint />
    </Section>
  );
}
