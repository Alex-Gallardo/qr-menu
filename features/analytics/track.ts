"use client";

import { clientSessionId } from "@/features/orders/client-session";
import type { ClientEvent } from "./metrics";
import type { EventBatch } from "./schemas";

/**
 * Eventos del menú público, en lotes: se juntan unos segundos y se mandan con
 * sendBeacon (sobrevive a cerrar la pestaña o irse a WhatsApp). Sin datos
 * personales: solo el id aleatorio del dispositivo.
 */

type Target = { businessId: string; branchId: string };
type Item = EventBatch["events"][number];

const FLUSH_MS = 3000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Una visita por sucursal cada 30 min en la misma pestaña (recargar no suma). */
const VISIT_WINDOW_MS = 30 * 60 * 1000;

let target: Target | null = null;
let queue: Item[] = [];
let timer: number | null = null;
let listening = false;

function send(to: Target, events: Item[]) {
  const body = JSON.stringify({ ...to, sessionId: clientSessionId(), events });
  try {
    if (navigator.sendBeacon?.("/api/ev", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Algunos navegadores integrados no permiten sendBeacon: se usa fetch.
  }
  void fetch("/api/ev", { method: "POST", body, keepalive: true }).catch(() => {});
}

export function flushEvents() {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  if (!target || queue.length === 0) return;
  for (let i = 0; i < queue.length; i += 25) send(target, queue.slice(i, i + 25));
  queue = [];
}

export function track(to: Target, event: ClientEvent, data: Omit<Item, "event"> = {}) {
  if (typeof window === "undefined" || navigator.webdriver) return;
  if (target && (target.branchId !== to.branchId || target.businessId !== to.businessId))
    flushEvents();
  target = to;
  // Un id raro (link de producto editado a mano) no debe tumbar el lote entero.
  const { productId, menuId, ...rest } = data;
  queue.push({
    event,
    ...rest,
    ...(productId && UUID.test(productId) ? { productId } : {}),
    ...(menuId && UUID.test(menuId) ? { menuId } : {}),
  });
  if (!listening) {
    listening = true;
    // Al ocultar la pestaña (WhatsApp, cambiar de app) se manda lo pendiente.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushEvents();
    });
    window.addEventListener("pagehide", flushEvents);
  }
  if (timer === null) timer = window.setTimeout(flushEvents, FLUSH_MS);
}

/** Visita al menú de la sucursal (una por pestaña cada 30 min). */
export function trackVisit(to: Target, data: Omit<Item, "event"> = {}) {
  const key = `qrm:visita:${to.branchId}`;
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < VISIT_WINDOW_MS) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Sin sessionStorage se cuenta cada carga.
  }
  track(to, "page_view", data);
}

/**
 * De dónde llegó: ?origen=qr (lo agrega /q/{código}) o ?source=pwa (la app
 * instalada). El parámetro del QR se quita para que no viaje al compartir.
 */
export function visitSource(): "qr" | "pwa" | undefined {
  const url = new URL(window.location.href);
  if (url.searchParams.get("origen") === "qr") {
    url.searchParams.delete("origen");
    window.history.replaceState(window.history.state, "", url);
    return "qr";
  }
  if (url.searchParams.get("source") === "pwa") return "pwa";
  return undefined;
}
