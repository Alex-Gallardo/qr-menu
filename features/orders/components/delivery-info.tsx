"use client";

import { CopyIcon, ExternalLinkIcon, NavigationIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCoords, mapLinks } from "@/features/location/lib/coords";
import type { OrderDetail } from "../inbox";

const LocationMap = dynamic(() => import("@/features/location/components/location-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado.`);
  } catch {
    toast.error("No se pudo copiar.");
  }
}

/** Entrega a domicilio: dirección, mapa del pin y Google Maps, Waze o "Copiar coordenadas". */
export function DeliveryInfo({
  address,
  addressReference,
  location,
}: Pick<OrderDetail, "address" | "addressReference" | "location">) {
  const links = location ? mapLinks(location) : null;
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="type-h3">Entrega</h2>
      {address ? <p className="type-body">{address}</p> : null}
      {addressReference ? (
        <p className="type-small text-muted-foreground">Referencia: {addressReference}</p>
      ) : null}
      {location && links ? (
        <>
          <div className="relative isolate h-64 overflow-hidden rounded-md border border-border">
            <LocationMap
              value={location}
              fallbackCenter={location}
              onChange={() => {}}
              readOnly
              className="size-full"
            />
          </div>
          <p className="type-small text-muted-foreground">
            {location.distanceKm !== null ? `A ${location.distanceKm} km de la sucursal · ` : ""}
            {location.source === "gps"
              ? `Ubicación del GPS${location.accuracyM !== null ? ` (±${Math.round(location.accuracyM)} m)` : ""}`
              : location.source === "mapa"
                ? "Marcada en el mapa por el cliente"
                : "Ubicación"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={links.google} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon />
                Abrir en Google Maps
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={links.waze} target="_blank" rel="noopener noreferrer">
                <NavigationIcon />
                Abrir en Waze
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copy(formatCoords(location), "Coordenadas")}
            >
              <CopyIcon />
              Copiar coordenadas
            </Button>
          </div>
        </>
      ) : (
        <p className="type-small text-muted-foreground">
          Sin pin en el mapa: solo la dirección escrita.
        </p>
      )}
    </section>
  );
}
