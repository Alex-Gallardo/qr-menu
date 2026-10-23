"use client";

import { DownloadIcon, PlusSquareIcon, ShareIcon, WifiOffIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { track } from "@/features/analytics/track";
import { isIOSDevice } from "@/features/notifications/support";
import { installOffer, isInAppBrowser, type InstallOffer } from "../pwa";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const dismissKey = (businessId: string) => `qrm:instalar:${businessId}`;

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/**
 * App del menú (QRM-036): registra el service worker del negocio, ofrece
 * instalarla (Android: el diálogo del navegador; iPhone: Compartir → Agregar
 * a inicio) y avisa cuando se ve la copia guardada sin conexión.
 */
export function InstallApp({
  businessId,
  branchId,
  businessSlug,
  businessName,
}: {
  businessId: string;
  /** Sucursal donde se instaló (para analíticas). */
  branchId: string;
  businessSlug: string;
  businessName: string;
}) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [offer, setOffer] = useState<InstallOffer>(null);
  const guideRef = useRef<HTMLDialogElement>(null);

  // Service worker con el alcance del negocio, después de cargar (no compite con el menú).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker
        .register("/menu-sw.js", { scope: `/${businessSlug}/`, updateViaCache: "none" })
        .catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, [businessSlug]);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(dismissKey(businessId)) === "no";
    } catch {
      // Sin almacenamiento: se puede ofrecer igual.
    }
    const context = {
      standalone:
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true,
      isIOS: isIOSDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
      inAppBrowser: isInAppBrowser(navigator.userAgent),
      dismissed,
    };
    const update = (hasPrompt: boolean) => setOffer(installOffer({ ...context, hasPrompt }));
    update(false);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // el botón propio decide cuándo
      setPrompt(e as InstallPromptEvent);
      update(true);
    };
    const onInstalled = () => {
      setOffer(null);
      track({ businessId, branchId }, "app_installed");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [businessId, branchId]);

  const dismiss = () => {
    setOffer(null);
    try {
      localStorage.setItem(dismissKey(businessId), "no");
    } catch {
      // Sin almacenamiento: se oculta solo en esta visita.
    }
  };

  const install = async () => {
    if (offer === "ios") return guideRef.current?.showModal();
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === "accepted") setOffer(null);
  };

  return (
    <>
      {offer ? (
        <aside
          aria-label="Instalar la app"
          className="mx-4 mt-8 flex items-center gap-3 rounded-[var(--menu-radius)] border border-[var(--menu-line)] bg-[var(--menu-surface)] p-3"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--menu-soft)] text-[var(--menu-primary)]">
            <DownloadIcon aria-hidden className="size-5" />
          </span>
          <p className="type-small min-w-0 flex-1">
            <strong className="block">Ten {businessName} en tu celular</strong>
            <span className="text-[var(--menu-muted)]">Pide más rápido desde el ícono.</span>
          </p>
          <button
            type="button"
            onClick={() => void install()}
            className="type-small h-10 shrink-0 rounded-full bg-[var(--menu-primary)] px-4 font-semibold text-[var(--menu-on-primary)]"
          >
            Instalar
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Ahora no"
            className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--menu-muted)] hover:bg-[var(--menu-soft)]"
          >
            <XIcon aria-hidden className="size-4" />
          </button>
        </aside>
      ) : null}

      <dialog
        ref={guideRef}
        aria-labelledby="instalar-titulo"
        onClick={(e) => e.target === e.currentTarget && guideRef.current?.close()}
        className="m-auto w-[min(22rem,calc(100%-2rem))] rounded-[var(--menu-radius)] border-0 bg-[var(--menu-surface)] p-5 text-[var(--menu-text)] shadow-3 backdrop:bg-black/50"
      >
        <h2 id="instalar-titulo" className="type-h3">
          Agrega {businessName} a tu inicio
        </h2>
        <ol className="type-body mt-3 grid list-decimal gap-3 pl-5">
          <li>
            Toca <ShareIcon aria-label="Compartir" className="inline size-4 align-text-bottom" />{" "}
            <strong>Compartir</strong> (abajo en Safari, arriba en iPad o en Chrome).
          </li>
          <li>
            Elige <PlusSquareIcon aria-hidden className="inline size-4 align-text-bottom" />{" "}
            <strong>Agregar a inicio</strong> y toca <strong>Agregar</strong>.
          </li>
          <li>
            Abre <strong>{businessName}</strong> desde tu pantalla de inicio.
          </li>
        </ol>
        <button
          type="button"
          onClick={() => guideRef.current?.close()}
          className="type-body mt-5 h-12 w-full rounded-full bg-[var(--menu-primary)] font-semibold text-[var(--menu-on-primary)]"
        >
          Entendido
        </button>
      </dialog>
    </>
  );
}

/** Sin conexión (p. ej. la app abierta en el bus): se ve la última copia guardada del menú. */
export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p
      role="status"
      className="type-small mx-4 mt-3 flex items-center gap-2 rounded-[var(--menu-radius)] bg-[var(--menu-soft)] px-4 py-3 font-semibold"
    >
      <WifiOffIcon aria-hidden className="size-5 shrink-0" />
      Sin conexión: este es el último menú que guardamos. Para pedir, conéctate otra vez.
    </p>
  );
}
