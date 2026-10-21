/**
 * Arranque de la bienvenida. Corre dos veces como mucho y solo la primera
 * hace algo:
 *  - como <script> en línea justo después del panel (HTML del servidor), para
 *    decidir antes del primer pintado y que tocar funcione sin esperar a React;
 *  - en el layout effect del componente, cuando el menú llegó por navegación
 *    del lado del cliente (ahí el script en línea no se ejecuta).
 *
 * Se inyecta con `runSplash.toString()`: debe ser JS simple, sin imports ni
 * referencias externas. Estados en `data-splash` del contenedor:
 * on → (skip) → done, u off si no toca mostrarla (frecuencia).
 */
export function runSplash(root: HTMLElement) {
  if (root.dataset.splash) return;
  const freq = root.dataset.freq;
  const key = "qrm:splash:" + root.dataset.key;
  let show = true;
  try {
    const store =
      freq === "first_visit" ? localStorage : freq === "once_per_session" ? sessionStorage : null;
    if (store) {
      show = !store.getItem(key);
      store.setItem(key, "1");
    }
  } catch {
    // Sin almacenamiento (modo privado estricto): se muestra.
  }
  if (!show) {
    root.dataset.splash = "off";
    return;
  }
  root.dataset.splash = "on";

  const panel = root.querySelector<HTMLElement>("[data-splash-panel]");
  const done = () => {
    if (root.dataset.splash !== "off") root.dataset.splash = "done";
  };
  // Saltar = las mismas animaciones, 6 veces más rápido (sin saltos visuales).
  const skip = () => {
    if (root.dataset.splash !== "on") return;
    root.dataset.splash = "skip";
    if (typeof root.getAnimations === "function")
      root.getAnimations({ subtree: true }).forEach((a) => a.updatePlaybackRate(6));
  };
  if (!panel) return done();
  panel.addEventListener("animationend", (e) => {
    if (e.target === panel && e.animationName.indexOf("splash-out") === 0) done();
  });
  panel.addEventListener("pointerdown", skip);
  window.addEventListener("keydown", skip, { once: true });
  // Respaldo por si no llega animationend (pestaña en segundo plano).
  setTimeout(done, Number(root.dataset.total || 3000) + 1000);
}

/** El <script> en línea: ejecuta runSplash sobre su contenedor. */
export const splashInlineScript = () =>
  `(${runSplash.toString()})(document.currentScript.parentElement)`;
