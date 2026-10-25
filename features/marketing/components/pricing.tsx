import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import type { PlanCard } from "../content";
import { TrackedLink } from "./tracked-link";

/** Gratis, Pro (resaltado) y Negocio; "Empezar" por plan; pago por transferencia. */
export function PricingCards({ plans }: { plans: PlanCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((p) => (
        <article
          key={p.id}
          className={cn(
            "relative grid content-start gap-4 rounded-2xl border bg-card p-6 shadow-1",
            p.highlight ? "border-2 border-primary shadow-2" : "border-border",
          )}
        >
          {p.highlight ? (
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
              El más elegido
            </span>
          ) : null}
          <h3 className="type-h3">{p.name}</h3>
          <p>
            <span className="font-display text-4xl font-bold tabular-nums">Q{p.priceGtq}</span>
            <span className="text-sm text-muted-foreground"> /mes</span>
          </p>
          {p.priceGtq > 0 ? (
            <p className="-mt-3 text-xs text-muted-foreground">
              o Q{(p.priceGtq * 10).toLocaleString("es-GT")} al año (2 meses gratis)
            </p>
          ) : (
            <p className="-mt-3 text-xs text-muted-foreground">Para siempre</p>
          )}
          <ul className="grid gap-2 text-sm">
            {p.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-aguacate" />
                {b}
              </li>
            ))}
          </ul>
          <TrackedLink
            href="/registro"
            event="cta_trial_click"
            place={`precios-${p.id}`}
            className={cn(
              "inline-flex h-12 items-center justify-center rounded-full px-5 font-semibold transition-transform active:scale-[0.97]",
              p.highlight
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background hover:bg-muted",
            )}
          >
            Empezar con {p.name}
          </TrackedLink>
        </article>
      ))}
    </div>
  );
}

/** Preguntas frecuentes con <details> (sin JavaScript). */
export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="grid gap-2">
      {items.map((f) => (
        <details
          key={f.q}
          className="group rounded-xl border border-border bg-card px-5 py-4 open:shadow-1"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
            {f.q}
            <span
              aria-hidden
              className="text-xl text-muted-foreground transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-2 text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
