"use client";

import { useEffect } from "react";
import { loadBrowserSentry } from "@/lib/sentry";
import "./globals.css";

/** Último recurso cuando falla el layout raíz. Mensaje sin culpa y opción de reintentar. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    void loadBrowserSentry().then((Sentry) => Sentry?.captureException(error));
  }, [error]);

  return (
    <html lang="es-GT">
      <body className="grid min-h-dvh place-content-center gap-4 px-4 text-center">
        <title>Algo no salió como esperábamos</title>
        <h1 className="type-h2">Algo no salió como esperábamos</h1>
        <p className="type-body text-muted-foreground">
          Ya nos avisaron del problema. Probemos otra vez.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mx-auto h-12 rounded-md bg-primary px-5 font-semibold text-primary-foreground"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
