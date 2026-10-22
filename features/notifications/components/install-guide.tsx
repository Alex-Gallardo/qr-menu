import { PlusSquareIcon, ShareIcon } from "lucide-react";
import { BRAND } from "@/lib/brand";

/**
 * En iPhone los avisos solo funcionan con la app en la pantalla de inicio
 * (iOS 16.4+): Safari → Compartir → Agregar a inicio, y abrirla desde ahí.
 */
export function IosInstallGuide({ app }: { app: "panel" | "staff" }) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-nube p-4">
      <p className="type-body font-semibold">En iPhone, primero instala la app</p>
      <ol className="type-body grid list-decimal gap-2 pl-5">
        <li>
          Abre esta página en <strong>Safari</strong>.
        </li>
        <li>
          Toca <ShareIcon aria-label="Compartir" className="inline size-4 align-text-bottom" />{" "}
          <strong>Compartir</strong> (abajo, o arriba en iPad).
        </li>
        <li>
          Elige <PlusSquareIcon aria-hidden className="inline size-4 align-text-bottom" />{" "}
          <strong>Agregar a inicio</strong> y toca “Agregar”.
        </li>
        <li>
          Abre <strong>{app === "panel" ? BRAND.name : "Pedidos"}</strong> desde tu pantalla de
          inicio y activa los avisos ahí.
        </li>
      </ol>
      <p className="type-small text-muted-foreground">Necesita iOS 16.4 o más reciente.</p>
    </div>
  );
}

/** Texto para cada caso en que no se pueden activar los avisos. */
export function unsupportedMessage(
  support: "ios_update" | "denied" | "unsupported" | "no_key",
): string {
  switch (support) {
    case "ios_update":
      return "Tu iPhone necesita iOS 16.4 o más reciente para recibir avisos. Actualízalo en Ajustes → General.";
    case "denied":
      return "Las notificaciones de este sitio están bloqueadas. Actívalas en los ajustes del navegador (el candado junto a la dirección) y vuelve aquí.";
    case "unsupported":
      return "Este navegador no recibe avisos. Abre la página en Chrome (Android) o Safari (iPhone).";
    case "no_key":
      return "Los avisos todavía no están configurados en este servidor.";
  }
}
