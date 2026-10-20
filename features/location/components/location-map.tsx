"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { roundCoords, type Coords } from "../lib/coords";

const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Pin en SVG (los íconos de imagen de Leaflet se rompen con los bundlers). */
const PIN = L.divIcon({
  className: "",
  iconSize: [36, 46],
  iconAnchor: [18, 44],
  html: `<svg width="36" height="46" viewBox="0 0 36 46" aria-hidden="true">
    <path d="M18 45C18 45 34 28.5 34 17A16 16 0 0 0 2 17C2 28.5 18 45 18 45Z" fill="var(--color-tomate)" stroke="white" stroke-width="2"/>
    <circle cx="18" cy="17" r="6" fill="white"/>
  </svg>`,
});

function ClickToPlace({ onChange }: { onChange: (c: Coords) => void }) {
  useMapEvents({ click: (e) => onChange(roundCoords({ lat: e.latlng.lat, lng: e.latlng.lng })) });
  return null;
}

/** Mueve el mapa cuando el pin cambia desde fuera (p. ej. "Usar mi ubicación"). */
function FollowValue({ value }: { value: Coords | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, value]);
  return null;
}

/**
 * Mapa con pin arrastrable. Tocar el mapa también mueve el pin.
 * Se carga solo en el navegador (import dinámico desde LocationPicker).
 */
export default function LocationMap({
  value,
  fallbackCenter,
  onChange,
  className,
}: {
  value: Coords | null;
  fallbackCenter: Coords;
  onChange: (coords: Coords) => void;
  className?: string;
}) {
  const center = value ?? fallbackCenter;
  const handlers = useMemo(
    () => ({
      dragend(e: L.DragEndEvent) {
        const { lat, lng } = (e.target as L.Marker).getLatLng();
        onChange(roundCoords({ lat, lng }));
      },
    }),
    [onChange],
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={value ? 16 : 12}
      scrollWheelZoom={false}
      className={className}
      attributionControl
    >
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      <ClickToPlace onChange={onChange} />
      <FollowValue value={value} />
      {value ? (
        <Marker
          position={[value.lat, value.lng]}
          icon={PIN}
          draggable
          eventHandlers={handlers}
          keyboard
          title="Arrastra el pin para ajustar la ubicación"
        />
      ) : null}
    </MapContainer>
  );
}
