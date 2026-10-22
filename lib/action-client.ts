import { unstable_rethrow } from "next/navigation";
import { loadBrowserSentry } from "@/lib/sentry";

export const OFFLINE_MESSAGE = "Parece que se fue el internet. Probemos otra vez.";
export const FAILED_MESSAGE = "No pudimos completar el cambio. Probemos otra vez.";

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

export function actionFailureMessage(error: unknown, online: boolean) {
  return isNetworkError(error, online) ? OFFLINE_MESSAGE : FAILED_MESSAGE;
}

const isOnline = () => typeof navigator === "undefined" || navigator.onLine;

/**
 * Llama una Server Action desde el cliente sin que una excepción tumbe la
 * pantalla (dentro de startTransition un error sube hasta error.tsx). Devuelve
 * `{ ok: false, message }` con un mensaje honesto; redirect() y notFound() de
 * Next siguen funcionando. Los errores que no son de conexión van a Sentry.
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
    if (!isNetworkError(error, online)) {
      void loadBrowserSentry().then((Sentry) => Sentry?.captureException(error));
    }
    return { ok: false, message: actionFailureMessage(error, online) };
  }
}
