"use client";

import { CrosshairIcon, MapPinIcon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { withLoading } from "@/lib/loading/store";
import { formatCoords, GUATEMALA_CITY, type Coords } from "../lib/coords";
import { geolocate } from "../lib/geolocate";

/** Leaflet (~40 KB gzip) se descarga solo cuando se muestra el mapa. */
const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

/** Precisión peor que esto: se sugiere ajustar el pin a mano. */
const POOR_ACCURACY_M = 150;

/**
 * Selector de ubicación: pin arrastrable + "Usar mi ubicación" (solo al tocar el
 * botón, nunca al abrir). Lo usan la sucursal (panel) y la entrega a domicilio.
 */
export function LocationPicker({
  value,
  onChange,
  fallbackCenter = GUATEMALA_CITY,
  label = "Ubicación en el mapa",
}: {
  value: Coords | null;
  onChange: (coords: Coords | null) => void;
  fallbackCenter?: Coords;
  label?: string;
}) {
  const [note, setNote] = useState<{ tone: "info" | "warning"; text: string } | null>(null);

  const useMyLocation = async () => {
    setNote(null);
    try {
      const result = await withLoading("Buscando tu ubicación…", (signal) => geolocate(signal));
      if (!result.ok) {
        setNote({ tone: "warning", text: result.message });
        return;
      }
      onChange(result.coords);
      setNote(
        result.accuracyM > POOR_ACCURACY_M
          ? {
              tone: "warning",
              text: `Precisión ±${result.accuracyM} m: arrastra el pin al lugar exacto.`,
            }
          : { tone: "info", text: `Precisión ±${result.accuracyM} m.` },
      );
    } catch (error) {
      if (!(error instanceof LoadingCancelledError)) throw error;
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={useMyLocation}>
            <CrosshairIcon />
            Usar mi ubicación
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <XIcon />
              Quitar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative isolate h-64 overflow-hidden rounded-lg border border-border sm:h-80">
        <LocationMap
          value={value}
          fallbackCenter={fallbackCenter}
          onChange={(c) => {
            setNote(null);
            onChange(c);
          }}
          className="h-full w-full"
        />
        {!value ? (
          <p className="type-small pointer-events-none absolute inset-x-3 bottom-3 z-[500] flex items-center gap-2 rounded-md bg-card/95 px-3 py-2 shadow-2">
            <MapPinIcon aria-hidden className="size-4 shrink-0 text-primary" />
            Toca el mapa para poner el pin.
          </p>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="type-small text-muted-foreground">
        {value ? (
          <>
            Pin en <span className="font-mono text-foreground">{formatCoords(value)}</span>.
            Arrástralo para ajustarlo.
          </>
        ) : (
          "Sin ubicación todavía."
        )}
        {note ? (
          <span className={note.tone === "warning" ? "mt-1 block text-foreground" : "mt-1 block"}>
            {note.text}
          </span>
        ) : null}
      </p>
    </div>
  );
}
