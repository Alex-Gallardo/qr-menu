import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/lib/errors";

/** Resultado estándar de una Server Action. */
export type ActionResult<T = undefined> =
  | ({ ok: true; message?: string } & (T extends undefined ? object : { data: T }))
  | { ok: false; message: string };

/**
 * Convierte errores conocidos (AppError: acceso, límites, validación) en un
 * resultado con mensaje para el usuario. Los demás se relanzan para Sentry;
 * redirect() y notFound() siguen funcionando.
 */
export function actionError(error: unknown): { ok: false; message: string } {
  unstable_rethrow(error);
  if (error instanceof AppError) return { ok: false, message: error.userMessage };
  throw error;
}
