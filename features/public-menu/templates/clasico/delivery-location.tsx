"use client";

import { CopyIcon, CrosshairIcon, HistoryIcon, MapIcon, MapPinIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { GUATEMALA_CITY, type Coords } from "@/features/location/lib/coords";
import { geolocate } from "@/features/location/lib/geolocate";
import {
  branchThatDelivers,
  deliveryCoverage,
  inAppBrowser,
  POOR_ACCURACY_M,
  type CoverageBranch,
  type DeliveryLocation,
  type OtherBranch,
} from "@/features/orders/delivery";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { withLoading } from "@/lib/loading/store";

/** Leaflet (~40 KB gzip) solo se descarga cuando aparece el mapa. */
const LocationMap = dynamic(() => import("@/features/location/components/location-map"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[var(--menu-line)]" />,
});

export type SavedPlace = { address: string; reference: string; location: DeliveryLocation };

const km = (n: number) => n.toLocaleString("es-GT", { maximumFractionDigits: 1 });

/**
 * "¿Dónde te lo llevamos?": ubicación actual (GPS), elegir en el mapa (el pin
 * empieza en la sucursal) o, si la sucursal lo permite, solo la dirección
 * escrita. Mide la cobertura y, si no llega, ofrece pasar a recoger o la
 * sucursal que sí entrega. En el navegador de Instagram/Facebook, donde la
 * ubicación suele estar bloqueada, sugiere el mapa y abrir en el navegador.
 */
export function DeliveryLocationField({
  businessName,
  businessSlug,
  branchName,
  branch,
  otherBranches,
  value,
  saved,
  problem,
  onChange,
  onUseSaved,
  onTakeout,
}: {
  businessName: string;
  businessSlug: string;
  branchName: string;
  branch: CoverageBranch & { requiresLocation: boolean };
  otherBranches: OtherBranch[];
  value: DeliveryLocation | null;
  /** La última dirección usada en este dispositivo. */
  saved: SavedPlace | null;
  problem?: string;
  onChange: (location: DeliveryLocation | null) => void;
  onUseSaved: (place: SavedPlace) => void;
  onTakeout: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const inApp = typeof navigator === "undefined" ? null : inAppBrowser(navigator.userAgent);
  const coords = value?.coords ?? null;
  const coverage = coords ? deliveryCoverage(branch, coords) : null;
  const alternative =
    coords && coverage && !coverage.ok ? branchThatDelivers(otherBranches, coords) : null;

  async function locateMe() {
    setNote(null);
    try {
      const result = await withLoading("Buscando tu ubicación…", (signal) => geolocate(signal));
      if (!result.ok) {
        setNote(result.message);
        return;
      }
      onChange({ coords: result.coords, accuracyM: result.accuracyM, source: "gps" });
      if (result.accuracyM > POOR_ACCURACY_M)
        setNote(`Precisión ±${result.accuracyM} m: arrastra el pin al lugar exacto.`);
    } catch (error) {
      if (!(error instanceof LoadingCancelledError)) throw error;
    }
  }

  function pickOnMap() {
    setNote("Mueve el pin (o toca el mapa) donde te lo llevamos.");
    onChange({ coords: branch.location ?? GUATEMALA_CITY, accuracyM: null, source: "mapa" });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado: pégalo en Chrome o Safari.");
    } catch {
      toast("Mantén presionado el link de arriba para copiarlo.");
    }
  }

  return (
    <div data-field="location" className="grid gap-3">
      <p className="type-small text-[var(--menu-muted)]">
        Compartiremos tu ubicación solo con {businessName} para entregar tu pedido.
      </p>

      {inApp ? (
        <div className="type-small grid gap-2 rounded-[calc(var(--menu-radius)*0.75)] bg-[var(--menu-surface)] p-3">
          <p>
            Estás en el navegador de {inApp}: si tu ubicación no aparece, elige en el mapa o abre
            este menú en Chrome o Safari.
          </p>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex h-10 items-center gap-1.5 justify-self-start rounded-full border border-[var(--menu-line)] px-3 font-semibold"
          >
            <CopyIcon aria-hidden className="size-4" />
            Copiar link
          </button>
        </div>
      ) : null}

      {saved && !coords && value?.source !== "manual" ? (
        <button
          type="button"
          onClick={() => {
            setNote(null);
            onUseSaved(saved);
          }}
          className="type-small flex min-h-12 items-center gap-2 rounded-[calc(var(--menu-radius)*0.75)] border border-[var(--menu-line)] bg-[var(--menu-surface)] px-3 py-2 text-left"
        >
          <HistoryIcon aria-hidden className="size-4 shrink-0" />
          <span>
            <span className="block font-semibold">Usar mi dirección guardada</span>
            <span className="text-[var(--menu-muted)]">{saved.address}</span>
          </span>
        </button>
      ) : null}

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => void locateMe()}
          className="type-small flex h-12 items-center justify-center gap-1.5 rounded-full bg-[var(--menu-primary)] px-3 font-semibold text-[var(--menu-on-primary)]"
        >
          <CrosshairIcon aria-hidden className="size-4 shrink-0" />
          Usar mi ubicación actual
        </button>
        <button
          type="button"
          onClick={pickOnMap}
          className="type-small flex h-12 items-center justify-center gap-1.5 rounded-full border border-[var(--menu-line)] bg-[var(--menu-surface)] px-3 font-semibold"
        >
          <MapIcon aria-hidden className="size-4 shrink-0" />
          Elegir en el mapa
        </button>
      </div>

      {coords ? (
        <div className="relative isolate h-56 overflow-hidden rounded-[calc(var(--menu-radius)*0.75)] border border-[var(--menu-line)]">
          <LocationMap
            value={coords}
            fallbackCenter={branch.location ?? GUATEMALA_CITY}
            onChange={(c: Coords) => {
              setNote(null);
              // Mover el pin a mano lo vuelve "mapa" (la precisión del GPS ya no aplica).
              onChange({ coords: c, accuracyM: null, source: "mapa" });
            }}
            className="size-full"
          />
        </div>
      ) : null}

      <div role="status" aria-live="polite" className="type-small grid gap-1">
        {value?.source === "gps" && value.accuracyM !== null && !note ? (
          <p className="text-[var(--menu-muted)]">Precisión ±{value.accuracyM} m.</p>
        ) : null}
        {note ? <p>{note}</p> : null}
        {coverage?.ok && coverage.distanceKm !== null ? (
          <p className="flex items-center gap-1.5 text-[var(--menu-muted)]">
            <MapPinIcon aria-hidden className="size-4" />A {km(coverage.distanceKm)} km de{" "}
            {branchName}
          </p>
        ) : null}
      </div>

      {coverage && !coverage.ok ? (
        <div
          role="alert"
          className="type-small grid gap-2 rounded-[calc(var(--menu-radius)*0.75)] bg-[color-mix(in_oklab,var(--color-destructive)_10%,var(--menu-surface))] p-3"
        >
          <p className="font-semibold">
            {coverage.message}{" "}
            {alternative
              ? "¿Prefieres pasar a recoger o pedir a la sucursal más cercana?"
              : "¿Pasas a recoger?"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onTakeout}
              className="h-10 rounded-full bg-[var(--menu-primary)] px-4 font-semibold text-[var(--menu-on-primary)]"
            >
              Pasar a recoger
            </button>
            {alternative ? (
              <Link
                href={`/${businessSlug}/${alternative.slug}`}
                className="inline-flex h-10 items-center rounded-full border border-[var(--menu-line)] bg-[var(--menu-surface)] px-4 font-semibold"
              >
                Pedir a {alternative.name}
              </Link>
            ) : null}
          </div>
        </div>
      ) : problem ? (
        <p role="alert" className="type-small font-semibold text-destructive">
          {problem}
        </p>
      ) : null}

      {!branch.requiresLocation && !coords ? (
        <button
          type="button"
          onClick={() => onChange({ coords: null, accuracyM: null, source: "manual" })}
          aria-pressed={value?.source === "manual"}
          className="type-small justify-self-start font-semibold text-[var(--menu-text)] underline underline-offset-4 aria-pressed:no-underline aria-pressed:opacity-60"
        >
          {value?.source === "manual"
            ? "Solo con la dirección escrita"
            : "Prefiero solo escribir la dirección"}
        </button>
      ) : null}
    </div>
  );
}
