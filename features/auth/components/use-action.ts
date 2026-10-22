"use client";

import { useState, useTransition } from "react";
import { runAction } from "@/lib/action-client";
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
      // redirect() de Next se propaga (no es un error real); lo demás vuelve como mensaje.
      setResult(await runAction(() => action(input)));
    });

  return { run, pending, result };
}
