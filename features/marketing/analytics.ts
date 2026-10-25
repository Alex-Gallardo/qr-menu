"use client";

/**
 * GA4 de la landing (guía: cta_trial_click, cta_whatsapp_click, demo_open,
 * signup_complete). Sin NEXT_PUBLIC_GA_ID no se carga nada y esto no hace nada.
 */

export type GaEvent = "cta_trial_click" | "cta_whatsapp_click" | "demo_open" | "signup_complete";

type Gtag = (...args: unknown[]) => void;

export function trackGa(event: GaEvent, params: Record<string, string> = {}) {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_GA_ID) return;
  // Si gtag.js aún no carga, el evento queda en la fila (dataLayer) y se manda al cargar.
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: Gtag };
  w.dataLayer = w.dataLayer ?? [];
  w.gtag =
    w.gtag ??
    function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  w.gtag("event", event, params);
}

/** Una sola vez por navegador (p. ej. signup_complete al llegar al asistente). */
export function trackGaOnce(event: GaEvent, key: string) {
  try {
    const k = `qrm:ga:${event}:${key}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
  } catch {
    // Sin almacenamiento: se manda igual.
  }
  trackGa(event);
}
