import { loadBrowserSentry, sentryOptions } from "@/lib/sentry";

// Errores del navegador sin tracing ni Session Replay, cargado cuando el hilo
// principal está libre: el menú se vuelve interactivo primero.
const start = () =>
  void loadBrowserSentry().then((Sentry) => {
    Sentry?.init({ ...sentryOptions(), integrations: [] });
  });

// En la landing, precios y legal (estáticas, sin datos del usuario) espera a la
// primera interacción o 15 s: no compite con la primera carga (Lighthouse ≥ 95).
const marketing = (path: string) => path === "/" || /^\/(?:precios|legal\/)/.test(path);

if (typeof window !== "undefined" && sentryOptions().enabled) {
  if (marketing(window.location.pathname)) {
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      start();
    };
    for (const type of ["pointerdown", "keydown"])
      window.addEventListener(type, once, { once: true, passive: true });
    setTimeout(once, 15_000);
  } else if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 2000);
}
