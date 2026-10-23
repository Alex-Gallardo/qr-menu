/*
 * Service worker de la app del menú (QRM-036). Se registra con el alcance de
 * cada negocio (/{negocio}/), aparte del de los avisos del panel (/sw.js):
 *  - Páginas del menú: primero la red; sin conexión, la última copia guardada
 *    (el menú avisa "Este es el último menú que guardamos").
 *  - JS/CSS de Next (/_next/static): inmutables, desde la caché.
 *  - Fotos: se muestran de la caché y se actualizan en segundo plano.
 * Nunca guarda la confirmación del pedido (/pedido/…: datos del cliente) ni
 * nada que no sea GET.
 */

const VERSION = "v1";
const PAGES = `qrm-menu-paginas-${VERSION}`;
const ASSETS = `qrm-menu-archivos-${VERSION}`;
const IMAGES = `qrm-menu-fotos-${VERSION}`;
const KEEP = [PAGES, ASSETS, IMAGES];
const MAX_IMAGES = 80;
const NETWORK_TIMEOUT_MS = 5000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("qrm-menu-") && !KEEP.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title></head><body style="font-family:system-ui,sans-serif;max-width:28rem;margin:20vh auto;padding:0 1.5rem;text-align:center;color:#231A17;background:#FBF6EE"><p style="font-size:1.125rem;line-height:1.5">Sin conexión y todavía no guardamos este menú. Conéctate y vuelve a abrirlo.</p></body></html>`;

/** La copia se guarda sin ?source ni ?mesa: una por página del menú. */
const pageKey = (url) => `${url.origin}${url.pathname}`;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function menuPage(request, url) {
  const cache = await caches.open(PAGES);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response.ok && response.type === "basic") cache.put(pageKey(url), response.clone());
    return response;
  } catch {
    const saved = await cache.match(pageKey(url));
    return (
      saved ||
      new Response(OFFLINE_HTML, {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function trimImages(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(key);
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(IMAGES);
  const saved = await cache.match(event.request);
  const fresh = fetch(event.request)
    .then(async (response) => {
      // "opaque": fotos de otro dominio sin CORS; igual se pueden mostrar desde la caché.
      if (response.ok || response.type === "opaque") {
        await cache.put(event.request, response.clone());
        await trimImages(cache);
      }
      return response;
    })
    .catch(() => saved);
  if (saved) {
    event.waitUntil(fresh);
    return saved;
  }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    if (url.origin !== self.location.origin || url.pathname.includes("/pedido/")) return;
    event.respondWith(menuPage(request, url));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (
    request.destination === "image" &&
    (url.origin !== self.location.origin || url.pathname.startsWith("/_next/image"))
  ) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
