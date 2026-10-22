/**
 * ¿Se pueden activar los avisos push en este dispositivo? Función pura para
 * probar cada caso; el componente le pasa lo que ve en el navegador.
 * En iPhone el push solo existe en la app instalada (iOS 16.4+): en Safari
 * primero hay que "Agregar a inicio".
 */

export type PushSupport =
  /** Se puede pedir permiso con un toque. */
  | "ready"
  /** iPhone/iPad en Safari: primero Compartir → Agregar a inicio. */
  | "ios_install"
  /** App instalada en un iOS sin push (antes de 16.4). */
  | "ios_update"
  /** El usuario bloqueó las notificaciones de este sitio. */
  | "denied"
  /** Navegador sin push (p. ej. dentro de Instagram o Facebook). */
  | "unsupported"
  /** Falta configurar la llave pública VAPID en este entorno. */
  | "no_key";

export type BrowserCapabilities = {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIOS: boolean;
  /** Abierta como app instalada (display-mode: standalone). */
  standalone: boolean;
  permission: "default" | "granted" | "denied" | null;
  hasKey: boolean;
};

export function pushSupport(c: BrowserCapabilities): PushSupport {
  if (!c.hasKey) return "no_key";
  const pushApis = c.hasServiceWorker && c.hasPushManager && c.hasNotification;
  if (c.isIOS && !c.standalone) return "ios_install";
  if (c.isIOS && !pushApis) return "ios_update";
  if (!pushApis) return "unsupported";
  if (c.permission === "denied") return "denied";
  return "ready";
}

/** iPhone, iPod o iPad (el iPad moderno se presenta como Mac con pantalla táctil). */
export function isIOSDevice(userAgent: string, platform: string, maxTouchPoints: number) {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

/** Llave pública VAPID (base64url) → bytes para pushManager.subscribe. */
export function vapidKeyBytes(base64url: string) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}
