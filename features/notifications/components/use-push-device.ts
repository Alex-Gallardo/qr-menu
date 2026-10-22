"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { runAction } from "@/lib/action-client";
import type { ActionResult } from "@/lib/action-result";
import { unsubscribePushAction } from "../actions";
import { isIOSDevice, pushSupport, vapidKeyBytes, type PushSupport } from "../support";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function capabilities() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return pushSupport({
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
    isIOS: isIOSDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    standalone,
    permission: "Notification" in window ? Notification.permission : null,
    hasKey: VAPID_PUBLIC_KEY.length > 0,
  });
}

const noSubscribe = () => () => {};

const register = () =>
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });

function sameKey(sub: PushSubscription) {
  const current = sub.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = vapidKeyBytes(VAPID_PUBLIC_KEY);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Estado de los avisos push en este navegador: ¿se pueden activar? ¿ya hay
 * suscripción? `enable` pide permiso (desde el toque), suscribe y la guarda
 * con la acción que le pasen (panel o staff); `disable` la borra de ambos lados.
 */
export function usePushDevice() {
  // "checking" en el servidor y al hidratar: evita diferencias de hidratación.
  const detected = useSyncExternalStore<PushSupport | "checking">(
    noSubscribe,
    capabilities,
    () => "checking",
  );
  const [denied, setDenied] = useState(false);
  const support = denied ? "denied" : detected;
  /** undefined = todavía no se sabe (se está leyendo del navegador). */
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (detected !== "ready" && detected !== "denied") return;
    register()
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setEndpoint(sub && sameKey(sub) ? sub.endpoint : null);
      })
      .catch(() => {
        if (!cancelled) setEndpoint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [detected]);

  const enable = useCallback(
    async (
      save: (sub: PushSubscriptionJSON) => Promise<ActionResult>,
    ): Promise<{ ok: boolean; message: string }> => {
      setBusy(true);
      try {
        // Primero el permiso, todavía dentro del toque (requisito de iOS).
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          if (permission === "denied") setDenied(true);
          return {
            ok: false,
            message:
              permission === "denied"
                ? "Bloqueaste las notificaciones. Actívalas en los ajustes del navegador."
                : "Necesitamos tu permiso para avisarte de los pedidos.",
          };
        }
        await register();
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (sub && !sameKey(sub)) {
          await sub.unsubscribe();
          sub = null;
        }
        sub ??= await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY),
        });
        const result = await runAction(() => save(sub.toJSON() as PushSubscriptionJSON));
        if (result.ok) setEndpoint(sub.endpoint);
        return { ok: result.ok, message: result.message ?? "" };
      } catch {
        return {
          ok: false,
          message: "Este navegador no pudo activar los avisos. Probemos otra vez.",
        };
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const disable = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        setEndpoint(null);
        return { ok: true, message: "Avisos desactivados en este dispositivo." };
      }
      const result = await runAction(() => unsubscribePushAction({ endpoint: sub.endpoint }));
      if (result.ok) {
        await sub.unsubscribe().catch(() => {});
        setEndpoint(null);
      }
      return { ok: result.ok, message: result.message ?? "" };
    } finally {
      setBusy(false);
    }
  }, []);

  return { support, endpoint, busy, enable, disable };
}
