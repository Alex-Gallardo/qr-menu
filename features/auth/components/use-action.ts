"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "../actions";

/**
 * Ejecuta una Server Action dentro de una transición y guarda su resultado.
 * `pending` sirve para el spinner del botón (evita dobles envíos).
 */
export function useAction<TInput>(action: (input: TInput) => Promise<ActionResult>) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const run = (input: TInput) =>
    startTransition(async () => {
      setResult(null);
      try {
        setResult(await action(input));
      } catch (error) {
        // redirect() de Next se propaga como excepción interna: no es un error real.
        unstable_rethrow(error);
        setResult({ ok: false, message: "Parece que se fue el internet. Probemos otra vez." });
      }
    });

  return { run, pending, result };
}
