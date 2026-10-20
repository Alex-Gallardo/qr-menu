import { loadBrowserSentry, sentryOptions } from "@/lib/sentry";

// Errores del navegador sin tracing ni Session Replay, cargado cuando el hilo
// principal está libre: el menú se vuelve interactivo primero.
const start = () =>
  void loadBrowserSentry().then((Sentry) => {
    Sentry?.init({ ...sentryOptions(), integrations: [] });
  });

if (typeof window !== "undefined" && sentryOptions().enabled) {
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 2000);
}
