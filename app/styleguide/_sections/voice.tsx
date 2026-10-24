"use client";

// Cliente: varias constantes viven en módulos "use client" (en el servidor serían referencias).
import { CheckIcon, XIcon } from "lucide-react";
import { SLOW_MESSAGE } from "@/components/feedback/loading-overlay";
import { SLUG_MESSAGES } from "@/features/businesses/slug";
import { GEO_MESSAGES } from "@/features/location/lib/geolocate";
import { reviewThanks, STAR_LABELS } from "@/features/reviews/reviews";
import { FAILED_MESSAGE, OFFLINE_MESSAGE, STALE_MESSAGE } from "@/lib/action-client";
import { Section } from "./section";

const GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Éxito",
    items: [
      "¡Listo! Guardamos tus cambios.",
      "¡Listo! Agregamos tu Desayuno chapín.",
      "¡Pedido #0042 recibido!",
      reviewThanks(5),
    ],
  },
  {
    title: "Error (sin culpa, con salida)",
    items: [
      FAILED_MESSAGE,
      OFFLINE_MESSAGE,
      STALE_MESSAGE,
      "No pudimos guardar la foto. Probemos otra vez.",
      GEO_MESSAGES.denied,
      SLUG_MESSAGES.taken,
    ],
  },
  {
    title: "Vacío (enseña el siguiente paso)",
    items: [
      "Aún no tienes productos. Agrega tus platillos una vez y úsalos en todos tus menús.",
      "Aún no tienes menús.",
      "Aún no tienes franjas.",
    ],
  },
  {
    title: "Carga (qué está pasando)",
    items: [
      "Preparando tu pedido…",
      "Subiendo tu foto…",
      "Publicando tu menú…",
      "Abriendo tu turno…",
      `${SLOW_MESSAGE} (a los 15 s, con Reintentar y Cancelar)`,
      "Guardando… → Guardado ✓",
    ],
  },
  {
    title: "Confirmación (la acción en el botón)",
    items: [
      "Cancelar → Sí, cancelar pedido / No",
      "Producto eliminado · Deshacer (6 s en vez de preguntar)",
      "¿Para cuándo? · ¿Cómo lo quieres? · ¿Cómo vas a pagar?",
    ],
  },
  {
    title: "Calificación",
    items: [STAR_LABELS.join(" · ")],
  },
];

const DO_DONT = [
  ["Tu link", "Slug"],
  ["App en tu pantalla de inicio", "PWA"],
  ["Tu negocio", "Tenant"],
  ["No pudimos guardar la foto. Probemos otra vez.", "Error 500"],
  ["Pedir por WhatsApp", "Enviar orden"],
] as const;

export function VoiceSection() {
  return (
    <Section
      id="voz"
      number={16}
      title="Voz y copys"
      description="Cercana y cálida: de tú con el comensal y de usted en el primer contacto comercial. Frases cortas, verbos de acción, guiños locales moderados. Los errores, la carga lenta y las estrellas salen de las mismas constantes que usa la app."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <div key={g.title} className="rounded-lg border border-border bg-card p-4 shadow-1">
            <h3 className="type-small font-semibold">{g.title}</h3>
            <ul className="type-small mt-2 grid list-disc gap-1.5 pl-5">
              {g.items.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h3 className="type-h3 mt-8">Se dice / no se dice</h3>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {DO_DONT.map(([yes, no]) => (
          <li
            key={yes}
            className="type-small grid grid-cols-2 overflow-hidden rounded-md border border-border bg-card"
          >
            <span className="flex items-center gap-2 p-3">
              <CheckIcon aria-label="Sí" className="size-4 shrink-0 text-success" />
              {yes}
            </span>
            <span className="flex items-center gap-2 bg-muted/50 p-3 text-muted-foreground line-through">
              <XIcon aria-label="No" className="size-4 shrink-0 text-destructive" />
              {no}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
