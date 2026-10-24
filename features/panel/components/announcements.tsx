"use client";

import { MegaphoneIcon, XIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "qrm:anuncios-cerrados";

function readClosed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
let snapshot = "";
const getSnapshot = () => {
  const next = JSON.stringify(readClosed());
  if (next !== snapshot) snapshot = next;
  return snapshot;
};

/** Anuncios de la plataforma arriba del panel; cada uno se cierra en este navegador. */
export function Announcements({ items }: { items: { id: string; title: string; body: string }[] }) {
  const closedRaw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const closed = JSON.parse(closedRaw) as string[];
  const visible = items.filter((a) => !closed.includes(a.id));
  if (visible.length === 0) return null;

  const close = (id: string) => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...readClosed(), id].slice(-50)));
    } catch {
      // Sin almacenamiento: se vuelve a ver al recargar.
    }
    listeners.forEach((fn) => fn());
  };

  return (
    <div className="grid">
      {visible.map((a) => (
        <div
          key={a.id}
          role="status"
          className="type-small flex items-start gap-3 bg-nube px-4 py-2.5 text-frijol lg:px-8"
        >
          <MegaphoneIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">{a.title}</span> {a.body}
          </p>
          <button
            type="button"
            aria-label="Cerrar anuncio"
            onClick={() => close(a.id)}
            className="-m-2 grid size-9 shrink-0 place-items-center rounded-full hover:bg-black/5"
          >
            <XIcon aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
