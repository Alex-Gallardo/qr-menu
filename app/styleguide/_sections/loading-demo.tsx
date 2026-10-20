"use client";

import { useState } from "react";
import { Loader } from "@/components/feedback/loaders";
import { SaveIndicator, type SaveState } from "@/components/feedback/save-indicator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { configureLoader, useLoading, withLoading, type LoaderStyle } from "@/lib/loading/store";

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

/** Ejecuta la demo y devuelve el texto del resultado (fuera del componente: mide tiempo). */
async function runDemo(ms: number, message: string) {
  const started = performance.now();
  try {
    await withLoading(message, (signal) => wait(ms, signal));
    return `Terminó en ${Math.round(performance.now() - started)} ms`;
  } catch (e) {
    return e instanceof LoadingCancelledError ? "Cancelada" : "Error";
  }
}

const DEMOS = [
  { label: "Rápida (200 ms, sin modal)", ms: 200, message: "Guardando…" },
  { label: "Normal (1.5 s)", ms: 1500, message: "Publicando tu menú…" },
  { label: "Lenta (20 s → reintentar)", ms: 20_000, message: "Preparando tu pedido…" },
] as const;

export function LoadingDemo() {
  const loader = useLoading((s) => s.loader);
  const [result, setResult] = useState("");
  const [save, setSave] = useState<SaveState>("idle");

  const run = async (ms: number, message: string) => {
    setResult("");
    setResult(await runDemo(ms, message));
  };

  const simulateSave = async (fail: boolean) => {
    setSave("saving");
    await new Promise((r) => setTimeout(r, 900));
    setSave(fail ? "error" : "saved");
  };

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <h3 className="type-h3">Modal “Cargando…”</h3>
        <p className="type-small text-muted-foreground">
          Aparece si tarda más de 300 ms, dura al menos 600 ms y a los 15 s ofrece Reintentar y
          Cancelar.
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMOS.map((d) => (
            <Button key={d.label} variant="secondary" onClick={() => run(d.ms, d.message)}>
              {d.label}
            </Button>
          ))}
        </div>
        <p className="type-small text-muted-foreground" aria-live="polite">
          {result}
        </p>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Indicadores (el negocio elige uno)</h3>
        <div className="flex flex-wrap gap-3">
          {(["logo", "puntos", "plato"] as LoaderStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              aria-pressed={loader === style}
              onClick={() => configureLoader({ loader: style })}
              className="grid w-28 justify-items-center gap-2 rounded-lg border border-border bg-card p-4 text-primary shadow-1 aria-pressed:ring-3 aria-pressed:ring-ring/40"
            >
              <Loader style={style} />
              <span className="type-caption text-foreground capitalize">{style}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Guardado automático</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => simulateSave(false)}>
            Guardar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => simulateSave(true)}>
            Guardar con error
          </Button>
          <SaveIndicator state={save} onRetry={() => simulateSave(false)} />
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Skeletons</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3 rounded-lg border border-border bg-card p-3 shadow-1">
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="aspect-[4/3] w-24 rounded-md" />
          </div>
          <div className="grid gap-2 rounded-lg border border-border bg-card p-3 shadow-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Botón con spinner</h3>
        <div className="flex flex-wrap gap-2">
          <Button loading>Guardando</Button>
          <Button variant="whatsapp" loading>
            Pedir por WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
