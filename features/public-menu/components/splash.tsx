"use client";

import Image from "next/image";
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "cn";
import { splashVars, type SplashConfig } from "../splash";
import { runSplash, splashInlineScript } from "../splash-script";

const noop = () => () => {};

/**
 * Bienvenida que se levanta y revela el menú, que ya está renderizado debajo
 * (el splash nunca retrasa la carga). La animación es CSS (globals.css,
 * "Bienvenida"): corre desde el HTML del servidor, sin esperar a React. Tocar
 * la salta; al terminar el panel se desmonta.
 */
export function Splash({
  config,
  storageKey,
  name,
  logoUrl,
  contained = false,
  children,
}: {
  /** null = sin bienvenida. */
  config: SplashConfig | null;
  /** Id del negocio: la frecuencia se cuenta por negocio, no por sucursal. */
  storageKey: string;
  name: string;
  logoUrl: string | null;
  /** Dentro de un marco (styleguide, vista previa de Apariencia) en vez de pantalla completa. */
  contained?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(config === null);
  // true solo en el servidor y al hidratar: el <script> en línea solo existe en ese HTML.
  const fromServer = useSyncExternalStore(
    noop,
    () => false,
    () => true,
  );

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !config) return;
    runSplash(root); // no hace nada si ya corrió el script en línea
    const check = () => {
      if (root.dataset.splash === "done" || root.dataset.splash === "off") setGone(true);
    };
    const observer = new MutationObserver(check);
    observer.observe(root, { attributes: true, attributeFilter: ["data-splash"] });
    const id = window.setTimeout(check, 0);
    return () => {
      observer.disconnect();
      window.clearTimeout(id);
    };
  }, [config]);

  if (!config) return <>{children}</>;
  const bg = config.background;

  return (
    <div
      ref={ref}
      data-key={storageKey}
      data-freq={config.frequency}
      data-total={config.durationMs}
      data-style={config.style}
      data-contained={contained ? "" : undefined}
      // data-splash lo pone el script antes de hidratar.
      suppressHydrationWarning
      style={splashVars(config) as CSSProperties}
      className={cn("splash-root", contained && "relative h-full overflow-hidden")}
    >
      {gone ? null : (
        <>
          <div
            data-splash-panel
            aria-hidden
            className={cn(
              "splash-panel inset-x-0 top-0 z-50 grid h-[calc(100%+32px)] cursor-pointer place-items-center overflow-hidden rounded-b-[32px] bg-(--splash-bg) pb-8 text-(--splash-text)",
              contained ? "absolute" : "fixed h-[calc(100dvh+32px)]",
            )}
          >
            {bg.type === "image" ? (
              <>
                <Image src={bg.url} alt="" fill priority unoptimized className="object-cover" />
                <span className="absolute inset-0 bg-black/35" />
              </>
            ) : null}
            <div className="splash-logo relative grid justify-items-center gap-3 px-8 text-center">
              <span className="relative grid size-(--splash-logo) place-items-center overflow-hidden rounded-full bg-white shadow-3">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt=""
                    fill
                    priority
                    sizes="144px"
                    className="object-cover"
                  />
                ) : (
                  <span className="font-heading text-[calc(var(--splash-logo)*0.42)] font-bold text-(--splash-letter)">
                    {name.slice(0, 1)}
                  </span>
                )}
              </span>
              {config.showName ? (
                <span className="splash-text grid gap-1">
                  <span className="type-h2">{name}</span>
                  {config.tagline ? (
                    <span className="type-body opacity-85">{config.tagline}</span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
          {fromServer ? (
            <script dangerouslySetInnerHTML={{ __html: splashInlineScript() }} />
          ) : null}
        </>
      )}
      <div className={cn("splash-menu", contained && "h-full overflow-y-auto")}>{children}</div>
    </div>
  );
}
