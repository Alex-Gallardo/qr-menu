"use client";

import { CheckIcon, PlayIcon } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { springEasing, SPLASH_EASING_LABELS, SPLASH_EASINGS } from "@/features/public-menu/splash";

const SPRING = springEasing(380, 32);

const CURVES = [
  {
    token: "--ease-out-soft",
    value: "cubic-bezier(0.22, 1, 0.36, 1)",
    use: "Casi todo: entra rápido y frena suave",
  },
  { token: "--ease-suave", value: "cubic-bezier(0.76, 0, 0.24, 1)", use: "Bienvenida “Suave”" },
  { token: "--ease-rapida", value: "cubic-bezier(0.4, 0, 0.2, 1)", use: "Bienvenida “Rápida”" },
  { token: "springEasing(380, 32)", value: "linear(…)", use: "Hoja y barra del carrito (resorte)" },
] as const;

type Demo = {
  name: string;
  spec: string;
  use: string;
  loop?: boolean;
  render: () => ReactNode;
};

const DOT = "size-10 rounded-full bg-primary";

const DEMOS: Demo[] = [
  {
    name: "Presionar",
    spec: "scale 0.96 · 120 ms · --duration-fast",
    use: "Todos los botones y tarjetas tocables",
    render: () => <Button size="sm">Presióname</Button>,
  },
  {
    name: "aparecer",
    spec: "250 ms · ease-out-soft · 8 px hacia arriba",
    use: "Tarjetas del menú en cascada (la primera vez)",
    render: () => (
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="animate-aparecer h-10 w-8 rounded-md bg-primary"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    ),
  },
  {
    name: "fundido",
    spec: "200 ms · ease-out",
    use: "Cambio de franja o de menú",
    render: () => <span className={cn(DOT, "animate-fundido")} />,
  },
  {
    name: "subir",
    spec: "320 ms · ease-out-soft (≈ resorte 380/32)",
    use: "Hojas de producto y de pedido",
    render: () => (
      <div className="h-14 w-24 overflow-hidden rounded-md bg-muted">
        <div className="animate-subir mt-4 h-10 rounded-t-md bg-primary" />
      </div>
    ),
  },
  {
    name: "barra",
    spec: "600 ms · resorte (--barra-ease)",
    use: "Barra del carrito al agregar el primero",
    render: () => (
      <div className="h-14 w-32 overflow-hidden rounded-md bg-muted">
        <div
          className="animate-barra mx-2 mt-5 h-7 rounded-full bg-primary"
          style={{ "--barra-ease": SPRING } as CSSProperties}
        />
      </div>
    ),
  },
  {
    name: "rebote-contador",
    spec: "450 ms · scale 1.25",
    use: "Contador del carrito al agregar",
    render: () => (
      <span className="animate-rebote-contador type-price grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
        3
      </span>
    ),
  },
  {
    name: "check",
    spec: "500 ms · ease-out-soft · rebote a 1.12",
    use: "Pedido enviado",
    render: () => (
      <span className="animate-check grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon aria-hidden className="size-6" strokeWidth={3} />
      </span>
    ),
  },
  {
    name: "confeti",
    spec: "900 ms · ease-out-soft · cae y gira",
    use: "Pedido enviado (ligero, sin librerías)",
    render: () => (
      <div className="relative h-16 w-24">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="animate-confeti absolute top-0 left-1/2 h-3 w-1.5 rounded-sm"
            style={
              {
                "--x": `${((i * 37) % 100) - 50}px`,
                "--r": `${(i * 53) % 360}deg`,
                animationDelay: `${(i % 5) * 60}ms`,
                background: ["var(--color-tomate)", "var(--color-maiz)", "var(--color-aguacate)"][
                  i % 3
                ],
              } as CSSProperties
            }
          />
        ))}
      </div>
    ),
  },
  {
    name: "latido",
    spec: "1.2 s · ease-in-out · infinito",
    use: "Estado “Nuevo” de un pedido",
    loop: true,
    render: () => (
      <span className="animate-latido type-caption rounded-full bg-primary px-2.5 py-1 font-semibold text-primary-foreground">
        Nuevo
      </span>
    ),
  },
  {
    name: "rebote",
    spec: "0.9 s · ease-in-out · infinito",
    use: "Puntos de “cargando”",
    loop: true,
    render: () => (
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="animate-rebote size-2.5 rounded-full bg-primary"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    ),
  },
  {
    name: "giro",
    spec: "1.1 s · linear · infinito",
    use: "Spinner de botones y overlays",
    loop: true,
    render: () => (
      <span className="animate-giro size-8 rounded-full border-4 border-primary/25 border-t-primary" />
    ),
  },
];

/** Sección 15 · cada animación con su duración y curva, y "menos movimiento". */
export function MotionDemo() {
  const [reduced, setReduced] = useState(false);
  const [run, setRun] = useState(0);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-11 items-center gap-3">
          <Switch checked={reduced} onCheckedChange={setReduced} />
          <span className="type-body font-semibold">Simular “reducir movimiento”</span>
        </label>
        <Button variant="outline" size="sm" onClick={() => setRun((r) => r + 1)}>
          <PlayIcon />
          Reproducir todo
        </Button>
      </div>
      <p className="type-small max-w-prose text-muted-foreground">
        Con “reducir movimiento” del sistema, todas las animaciones y transiciones duran 1 ms (regla
        global de globals.css); la bienvenida cambia a un fundido de 300 ms. El interruptor aplica
        la misma regla solo a esta demo.
      </p>

      <ul
        data-menos-movimiento={reduced || undefined}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {DEMOS.map((d) => (
          <li
            key={d.name}
            className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-1"
          >
            <div key={d.loop ? undefined : run} className="grid h-20 place-items-center">
              {d.render()}
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">{d.name}</p>
              <p className="type-caption tabular-nums">{d.spec}</p>
              <p className="type-caption text-muted-foreground">{d.use}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-1">
        <table className="type-small w-full min-w-[36rem] text-left">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3 font-semibold">Curva</th>
              <th className="p-3 font-semibold">Valor</th>
              <th className="p-3 font-semibold">Uso</th>
            </tr>
          </thead>
          <tbody>
            {CURVES.map((c) => (
              <tr key={c.token} className="border-b border-border last:border-0">
                <td className="p-3 font-mono">{c.token}</td>
                <td className="p-3 font-mono text-xs">{c.value}</td>
                <td className="p-3">{c.use}</td>
              </tr>
            ))}
            <tr>
              <td className="p-3 font-mono">Bienvenida</td>
              <td className="p-3 font-mono text-xs">{Object.keys(SPLASH_EASINGS).length} curvas</td>
              <td className="p-3">
                {Object.values(SPLASH_EASING_LABELS).join(", ")}: se prueban con “Reproducir” en la
                sección Bienvenida.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
