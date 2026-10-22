/*
 * Service worker de las apps del negocio (panel y staff): solo avisos push.
 * No intercepta peticiones (sin "fetch"): la app siempre carga de la red.
 * El mensaje lo arma features/notifications/messages.ts: { title, body, url, tag }.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Nuevo pedido";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "pedido",
      // Un aviso del mismo pedido reemplaza al anterior, pero vuelve a sonar y vibrar.
      renotify: Boolean(data.tag),
      // Se queda en pantalla hasta que alguien lo toque o lo descarte.
      requireInteraction: true,
      vibrate: [300, 120, 300, 120, 300],
      icon: "/app-icon/192",
      badge: "/app-icon/192",
      lang: "es-GT",
      timestamp: Date.now(),
      data: { url: data.url || "/panel" },
    }),
  );
});

/** Al tocar el aviso: abre el detalle del pedido en la app (o la trae al frente). */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/panel", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = windows.find((w) => w.url === url);
      if (same) return same.focus();
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        try {
          const focused = await open.focus();
          return await focused.navigate(url);
        } catch {
          // Ventana no controlada por este service worker: abrir una nueva.
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
