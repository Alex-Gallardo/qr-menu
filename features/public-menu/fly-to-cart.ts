"use client";

/**
 * Al agregar, una copia de la foto vuela a la barra del carrito (450 ms). La
 * foto se mide al tocar (la hoja que la tenía puede cerrarse) y el destino un
 * par de cuadros después: con el primer producto la barra recién aparece.
 * Sin animación si el usuario pidió menos movimiento.
 */
export function flyToCart(from: HTMLElement | null) {
  if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = from.getBoundingClientRect();
  if (start.width === 0) return;
  const img = from.querySelector("img");
  const src = img?.currentSrc || img?.src || null;
  const radius = getComputedStyle(from).borderRadius;

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>("[data-cart-target]");
      if (!target) return;
      const end = target.getBoundingClientRect();

      const ghost = document.createElement("div");
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, {
        position: "fixed",
        left: `${start.left}px`,
        top: `${start.top}px`,
        width: `${start.width}px`,
        height: `${start.height}px`,
        borderRadius: radius,
        overflow: "hidden",
        zIndex: "60",
        pointerEvents: "none",
        background: "var(--menu-soft, #f1ebe3)",
        transformOrigin: "center",
      });
      if (src) {
        const copy = document.createElement("img");
        copy.src = src;
        copy.alt = "";
        Object.assign(copy.style, { width: "100%", height: "100%", objectFit: "cover" });
        ghost.append(copy);
      }
      document.body.append(ghost);

      const dx = end.left + end.width / 2 - (start.left + start.width / 2);
      const dy = end.top + end.height / 2 - (start.top + start.height / 2);
      const scale = Math.max(0.08, end.width / start.width);
      ghost
        .animate(
          [
            { transform: "translate(0, 0) scale(1)", opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.4 },
          ],
          { duration: 450, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
        )
        .finished.catch(() => {})
        .finally(() => ghost.remove());
    }),
  );
}
