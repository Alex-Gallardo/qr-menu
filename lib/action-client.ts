import { unstable_isUnrecognizedActionError, unstable_rethrow } from "next/navigation";
import { toast } from "sonner";
import { loadBrowserSentry } from "@/lib/sentry";

export const OFFLINE_MESSAGE = "Parece que se fue el internet. Probemos otra vez.";
export const FAILED_MESSAGE = "No pudimos completar el cambio. Probemos otra vez.";
export const STALE_MESSAGE = "Hay una versión nueva de la app. Recarga la página para seguir.";

/**
 * ¿La petición ni siquiera llegó al servidor? fetch() rechaza con TypeError
 * ("Failed to fetch", "Load failed", "NetworkError…") o el navegador dice que
 * está sin conexión. Cualquier otra excepción es una respuesta rara del
 * servidor: decir "se fue el internet" ahí confunde (con internet funcionando).
 */
export function isNetworkError(error: unknown, online: boolean) {
  if (!online) return true;
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}

/**
 * ¿La página es de una versión anterior? Después de un deploy (o de una
 * recompilación en desarrollo) la acción que conoce el navegador ya no existe
 * en el servidor (409 "Server Action not found"), o falta un archivo JS de la
 * versión vieja. Reintentar no sirve: hay que recargar.
 */
export function isStaleAppError(error: unknown) {
  if (unstable_isUnrecognizedActionError(error)) return true;
  const e = error as { name?: unknown; message?: unknown } | null;
  return (
    e?.name === "ChunkLoadError" ||
    (typeof e?.message === "string" &&
      /Failed to load chunk|Loading chunk .* failed/i.test(e.message))
  );
}

export function actionFailureMessage(error: unknown, online: boolean) {
  if (isStaleAppError(error)) return STALE_MESSAGE;
  return isNetworkError(error, online) ? OFFLINE_MESSAGE : FAILED_MESSAGE;
}

const isOnline = () => typeof navigator === "undefined" || navigator.onLine;

/** Aviso fijo con "Recargar" (uno solo aunque fallen varias acciones). */
function offerReload() {
  toast(STALE_MESSAGE, {
    id: "version-nueva",
    duration: Infinity,
    action: { label: "Recargar", onClick: () => window.location.reload() },
  });
}

/**
 * Llama una Server Action desde el cliente sin que una excepción tumbe la
 * pantalla (dentro de startTransition un error sube hasta error.tsx). Devuelve
 * `{ ok: false, message }` con un mensaje honesto; redirect() y notFound() de
 * Next siguen funcionando. Los errores que no son de conexión ni de versión
 * vieja van a Sentry.
 *
 *   const res = await runAction(() => saveMenu(input));
 *   if (!res.ok) toast.error(res.message);
 */
export async function runAction<T>(
  action: () => Promise<T>,
): Promise<T | { ok: false; message: string }> {
  try {
    return await action();
  } catch (error) {
    unstable_rethrow(error);
    const online = isOnline();
    if (isStaleAppError(error)) offerReload();
    else if (!isNetworkError(error, online)) {
      void loadBrowserSentry().then((Sentry) => Sentry?.captureException(error));
    }
    return { ok: false, message: actionFailureMessage(error, online) };
  }
}
