"use client";

import { CheckIcon, EllipsisVerticalIcon, EraserIcon, RepeatIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "cn";
import { SaveIndicator } from "@/components/feedback/save-indicator";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAutosave } from "@/lib/use-autosave";
import { saveScheduleAction } from "../actions";
import {
  cellKey,
  effectiveCell,
  fillWeek,
  GRID_WEEKDAYS,
  MENU_COLORS,
  menuInitials,
  setCell,
  WEEKDAY_SHORT,
  type Grid,
} from "../grid";
import { formatSlotRange } from "../slots";

type Menu = { id: string; name: string };
type Slot = { id: string; name: string; start_time: string; end_time: string };

/**
 * Cuadrícula días × franjas. Tocar una celda elige el menú; "⋯" de la franja
 * llena o vacía la semana. En una sucursal, las celdas heredadas de la general
 * se ven punteadas y las propias, sólidas (la propia gana). Se guarda sola.
 */
export function ScheduleGrid({
  businessId,
  branchId,
  scopeLabel,
  slots,
  menus,
  generalGrid,
  initialGrid,
  canEdit,
}: {
  businessId: string;
  /** null = todas las sucursales. */
  branchId: string | null;
  scopeLabel: string;
  slots: Slot[];
  menus: Menu[];
  /** Cuadrícula general (para mostrar lo heredado en una sucursal). */
  generalGrid: Grid;
  /** Cuadrícula del alcance que se edita. */
  initialGrid: Grid;
  canEdit: boolean;
}) {
  const [grid, setGrid] = useState(initialGrid);
  const save = useCallback(
    (cells: Grid) => saveScheduleAction({ businessId, branchId, cells }),
    [businessId, branchId],
  );
  const autosave = useAutosave(grid, save);
  const color = (menuId: string) =>
    MENU_COLORS[menus.findIndex((m) => m.id === menuId) % MENU_COLORS.length];
  const menuName = (menuId: string | null) => menus.find((m) => m.id === menuId)?.name ?? "";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-1.5" aria-label="Menús y sus colores">
          {menus.map((m) => (
            <li
              key={m.id}
              className={cn("type-caption rounded-full px-2.5 py-1 font-semibold", color(m.id))}
            >
              {m.name}
            </li>
          ))}
        </ul>
        {canEdit ? <SaveIndicator state={autosave.state} onRetry={autosave.retry} /> : null}
      </div>
      {autosave.state === "error" && autosave.error ? (
        <FormMessage tone="error">{autosave.error}</FormMessage>
      ) : null}

      <div className="grid gap-3" role="grid" aria-label={`Programación de ${scopeLabel}`}>
        <div role="row" className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {GRID_WEEKDAYS.map((d) => (
            <span
              key={d}
              role="columnheader"
              className="type-caption text-center font-semibold text-muted-foreground"
            >
              {WEEKDAY_SHORT[d]}
            </span>
          ))}
        </div>

        {slots.map((slot) => (
          <div key={slot.id} className="grid gap-1.5" role="rowgroup">
            <div className="flex items-center justify-between gap-2">
              <p className="type-small">
                <span className="font-semibold">{slot.name}</span>{" "}
                <span className="text-muted-foreground tabular-nums">{formatSlotRange(slot)}</span>
              </p>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${slot.name}`}>
                      <EllipsisVerticalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="type-caption text-muted-foreground">
                      Toda la semana
                    </DropdownMenuLabel>
                    {menus.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        className="min-h-11"
                        onSelect={() => setGrid((g) => fillWeek(g, slot.id, m.id))}
                      >
                        <RepeatIcon />
                        {m.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="min-h-11"
                      onSelect={() => setGrid((g) => fillWeek(g, slot.id, null))}
                    >
                      <EraserIcon />
                      {branchId ? "Usar la general toda la semana" : "Vaciar la franja"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            <div role="row" className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {GRID_WEEKDAYS.map((day) => {
                const key = cellKey(slot.id, day);
                const cell = branchId
                  ? effectiveCell(generalGrid, grid, key)
                  : effectiveCell(grid, null, key);
                const name = menuName(cell.menuId);
                const label = `${slot.name}, ${WEEKDAY_SHORT[day]}: ${
                  name
                    ? `${name}${cell.source === "general" && branchId ? " (de la general)" : ""}`
                    : "sin menú"
                }`;
                const content = (
                  <span
                    className={cn(
                      "type-caption flex h-11 w-full items-center justify-center overflow-hidden rounded-md px-0.5 font-semibold sm:h-12",
                      !cell.menuId && "border border-dashed border-border text-muted-foreground",
                      cell.menuId && cell.source === "branch" && color(cell.menuId),
                      cell.menuId && cell.source === "general" && !branchId && color(cell.menuId),
                      cell.menuId &&
                        cell.source === "general" &&
                        branchId &&
                        "border-2 border-dashed border-muted-foreground/40 bg-muted text-muted-foreground",
                    )}
                  >
                    {name ? (
                      <>
                        <span className="sm:hidden">{menuInitials(name)}</span>
                        <span className="hidden truncate sm:inline">{name}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                );
                if (!canEdit) {
                  return (
                    <span key={key} role="gridcell" aria-label={label} title={label}>
                      {content}
                    </span>
                  );
                }
                return (
                  <DropdownMenu key={key}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        role="gridcell"
                        aria-label={label}
                        title={label}
                        className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {content}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-64">
                      <DropdownMenuLabel className="type-caption text-muted-foreground">
                        {slot.name} · {WEEKDAY_SHORT[day]}
                      </DropdownMenuLabel>
                      {menus.map((m) => (
                        <DropdownMenuItem
                          key={m.id}
                          className="min-h-11"
                          onSelect={() => setGrid((g) => setCell(g, key, m.id))}
                        >
                          <span className={cn("size-3 rounded-full", color(m.id))} aria-hidden />
                          {m.name}
                          {grid[key] === m.id ? <CheckIcon className="ml-auto" /> : null}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="min-h-11"
                        onSelect={() => setGrid((g) => setCell(g, key, null))}
                      >
                        <EraserIcon />
                        {branchId
                          ? `Igual que la general${generalGrid[key] ? ` (${menuName(generalGrid[key]!)})` : ""}`
                          : "Sin menú"}
                        {!grid[key] ? <CheckIcon className="ml-auto" /> : null}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="type-small text-muted-foreground">
        {branchId
          ? "Punteado = viene de “Todas las sucursales”. Sólido = propio de esta sucursal (gana a la general)."
          : "Donde no hay menú se muestra tu menú predeterminado."}
      </p>
    </div>
  );
}
