"use client";

import { ChevronRightIcon, LocateFixedIcon, MapPinIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { openState } from "@/features/branches/hours";
import { geolocate } from "@/features/location/lib/geolocate";
import { distanceKm } from "@/features/location/lib/haversine";
import type { Coords } from "@/features/location/lib/coords";
import { guatemalaNow } from "@/lib/gt-time";
import { useNowMinute } from "../use-now";
import { rememberBranch, rememberedBranch } from "./remember-branch";

export type SelectorBranch = {
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  hours: { weekday: number; opens: string; closes: string }[];
};

const noopSubscribe = () => () => {};

/**
 * Selector de sucursal: tarjetas con zona y "Abierto · cierra 22:00". Con
 * permiso de ubicación se ordenan por cercanía y muestran la distancia. La
 * última sucursal elegida en este celular aparece primero.
 */
export function BranchSelector({
  businessSlug,
  branches,
}: {
  businessSlug: string;
  branches: SelectorBranch[];
}) {
  const now = useNowMinute();
  const remembered = useSyncExternalStore(
    noopSubscribe,
    () => rememberedBranch(businessSlug),
    () => null,
  );
  const [here, setHere] = useState<Coords | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, startLocating] = useTransition();

  const distance = (b: SelectorBranch) =>
    here && b.lat !== null && b.lng !== null ? distanceKm(here, { lat: b.lat, lng: b.lng }) : null;

  const ordered = [...branches].sort((a, b) => {
    if (here) {
      const da = distance(a) ?? Number.POSITIVE_INFINITY;
      const db = distance(b) ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
    } else if (remembered) {
      if (a.slug === remembered) return -1;
      if (b.slug === remembered) return 1;
    }
    return 0;
  });

  const locate = () =>
    startLocating(async () => {
      setMessage(null);
      const result = await geolocate();
      if (result.ok) setHere(result.coords);
      // Sin culpa: sin ubicación, se elige de la lista (aquí no hay mapa).
      else setMessage("No pudimos usar tu ubicación. Sin problema: elige tu sucursal de la lista.");
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-h3">Elige tu sucursal</h2>
        <Button variant="outline" size="sm" loading={locating} onClick={locate}>
          <LocateFixedIcon />
          {here ? "Actualizar cercanía" : "Ordenar por cercanía"}
        </Button>
      </div>
      {message ? (
        <p role="status" className="type-small text-[var(--menu-muted)]">
          {message}
        </p>
      ) : null}
      <ul className="grid gap-3">
        {ordered.map((b, index) => {
          const state = now ? openState(b.hours, guatemalaNow(now)) : null;
          const km = distance(b);
          const zone = [b.address, b.city].filter(Boolean).join(", ");
          return (
            <li key={b.slug}>
              <Link
                href={`/${businessSlug}/${b.slug}`}
                onClick={() => rememberBranch(businessSlug, b.slug)}
                className="group flex items-center gap-4 rounded-xl border border-[var(--menu-line)] bg-[var(--menu-surface)] p-4 shadow-1 transition-shadow hover:shadow-2 active:scale-[0.99]"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--menu-soft)] text-[var(--menu-primary)]">
                  <StoreIcon aria-hidden className="size-6" />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-h3">{b.name}</span>
                    {here && index === 0 && km !== null ? (
                      <span className="type-caption rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success">
                        La más cercana
                      </span>
                    ) : !here && b.slug === remembered ? (
                      <span className="type-caption rounded-full bg-maiz/30 px-2 py-0.5 font-semibold">
                        Tu última sucursal
                      </span>
                    ) : null}
                  </span>
                  {zone ? (
                    <span className="type-small truncate text-[var(--menu-muted)]">{zone}</span>
                  ) : null}
                  <span className="type-small flex flex-wrap gap-x-3">
                    {!b.isActive ? (
                      <span className="font-semibold text-[var(--menu-muted)]">En pausa</span>
                    ) : state ? (
                      <span
                        className={cn(
                          "font-semibold",
                          state.open ? "text-success" : "text-[var(--menu-muted)]",
                        )}
                      >
                        {state.label}
                      </span>
                    ) : null}
                    {km !== null ? (
                      <span className="inline-flex items-center gap-1 text-[var(--menu-muted)] tabular-nums">
                        <MapPinIcon aria-hidden className="size-3.5" />
                        {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}
                      </span>
                    ) : null}
                  </span>
                </span>
                <ChevronRightIcon
                  aria-hidden
                  className="size-5 shrink-0 text-[var(--menu-muted)] transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
