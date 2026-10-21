import { ArrowRightIcon, CalendarOffIcon, ClockIcon, UtensilsCrossedIcon } from "lucide-react";
import Link from "next/link";
import type { ResolverData } from "../program-server";
import { resolveActiveMenu, resolveNextMenu, type ActiveMenu } from "../resolve-active-menu";

/**
 * "Menú del día" en Inicio: lo que ve hoy cada sucursal y lo que sigue,
 * calculado con la misma función que usará el menú público.
 */
export function TodayMenuCard({
  data,
  branches,
  now,
  scheduleHref,
}: {
  data: ResolverData;
  branches: { id: string; name: string }[];
  now: Date;
  scheduleHref: string;
}) {
  const menuName = (id: string | null) => data.menus.find((m) => m.id === id)?.name ?? "Sin menú";

  return (
    <section aria-labelledby="menu-del-dia" className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="menu-del-dia" className="type-h3">
          Menú del día
        </h2>
        <Link
          href={scheduleHref}
          className="type-small inline-flex items-center gap-1 font-semibold text-tomate-700 hover:underline"
        >
          Cambiar
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {branches.map((branch) => {
          const input = { branchId: branch.id, ...data };
          const active = resolveActiveMenu(input, now);
          const next = active.status === "open" ? resolveNextMenu(input, now) : null;
          return (
            <li
              key={branch.id}
              className="grid gap-2 rounded-lg border border-border bg-card p-4 shadow-1"
            >
              {branches.length > 1 ? (
                <p className="type-caption font-semibold text-muted-foreground">{branch.name}</p>
              ) : null}
              <Now active={active} menuName={menuName} />
              {next ? (
                <p className="type-small text-muted-foreground">
                  Sigue:{" "}
                  <span className="font-semibold text-foreground">{menuName(next.menuId)}</span>{" "}
                  {next.tomorrow ? "mañana " : ""}a las {next.slot?.start_time}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Now({
  active,
  menuName,
}: {
  active: ActiveMenu;
  menuName: (id: string | null) => string;
}) {
  if (active.status === "closed") {
    return (
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <CalendarOffIcon aria-hidden className="size-5" />
        {active.message}
      </p>
    );
  }
  if (active.status === "upcoming") {
    return (
      <p className="flex items-start gap-2">
        <ClockIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <span>
          <span className="block font-semibold">{menuName(active.menuId)}</span>
          <span className="type-small text-muted-foreground">{active.message}</span>
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2">
      <UtensilsCrossedIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <span>
        <span className="block font-semibold">{menuName(active.menuId)}</span>
        <span className="type-small text-muted-foreground">
          {active.status === "default"
            ? "Menú predeterminado (no hay programación para esta hora)"
            : `Ahora · ${active.slot?.name} hasta las ${active.slot?.end_time}`}
        </span>
      </span>
    </p>
  );
}
