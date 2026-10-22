"use client";

import { CalendarOffIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runAction } from "@/lib/action-client";
import { formatDateEs } from "@/lib/gt-time";
import { removeOverrideAction, saveOverrideAction } from "../actions";
import type { OverrideRow } from "../program-server";

type Option = { id: string; name: string };

const selectClass =
  "h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

/**
 * Fechas especiales del alcance (feriados, "Cerrado hoy", un menú distinto un
 * día). Ganan a la programación semanal.
 */
export function OverridesManager({
  businessId,
  branchId,
  today,
  overrides,
  slots,
  menus,
  branches,
  canEdit,
  canChooseMenu,
}: {
  businessId: string;
  /** null = todas las sucursales. */
  branchId: string | null;
  today: string;
  /** Las de este alcance y, en una sucursal, también las generales (solo lectura). */
  overrides: OverrideRow[];
  slots: Option[];
  menus: Option[];
  /** Para decir de qué sucursal viene una fecha heredada. */
  branches: Option[];
  canEdit: boolean;
  /** Elegir un menú distinto pide la función "scheduling"; cerrar no. */
  canChooseMenu: boolean;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();
  const visible = overrides.filter((o) => !hidden.includes(o.id));
  const slotName = (id: string | null) =>
    id ? (slots.find((s) => s.id === id)?.name ?? "Franja") : "Todo el día";
  const menuName = (id: string | null) =>
    id ? (menus.find((m) => m.id === id)?.name ?? "Menú") : null;
  const closedToday = visible.some(
    (o) => o.date === today && o.branch_id === branchId && !o.time_slot_id && !o.menu_id,
  );

  const save = (input: Record<string, unknown>, after?: () => void) =>
    startTransition(async () => {
      const res = await runAction(() => saveOverrideAction({ businessId, branchId, ...input }));
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      after?.();
      router.refresh();
    });

  const remove = (row: OverrideRow) => {
    setHidden((h) => [...h, row.id]);
    startTransition(async () => {
      const res = await runAction(() => removeOverrideAction({ businessId, overrideId: row.id }));
      if (!res.ok) {
        setHidden((h) => h.filter((id) => id !== row.id));
        return void toast.error(res.message);
      }
      router.refresh();
      toast("Fecha especial eliminada", {
        duration: 6000,
        action: {
          label: "Deshacer",
          onClick: async () => {
            const undo = await runAction(() => saveOverrideAction(res.data.restore));
            if (undo.ok) {
              toast.success("Recuperamos la fecha especial.");
              router.refresh();
            } else toast.error(undo.message);
          },
        },
      });
    });
  };

  return (
    <div className="grid gap-4">
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={closedToday}
            onClick={() => save({ date: today, slotId: null, menuId: null, note: "Cerrado hoy" })}
          >
            <CalendarOffIcon />
            {closedToday ? "Hoy ya está cerrado" : "Cerrado hoy"}
          </Button>
          {!adding ? (
            <Button variant="ghost" onClick={() => setAdding(true)}>
              <PlusIcon />
              Agregar fecha especial
            </Button>
          ) : null}
        </div>
      ) : null}

      {adding ? (
        <OverrideForm
          today={today}
          slots={slots}
          menus={menus}
          canChooseMenu={canChooseMenu}
          onCancel={() => setAdding(false)}
          onSave={(input) => save(input, () => setAdding(false))}
        />
      ) : null}

      {visible.length === 0 ? (
        <p className="type-small text-muted-foreground">Sin fechas especiales próximas.</p>
      ) : (
        <ul className="grid divide-y divide-border rounded-lg border border-border">
          {visible.map((o) => {
            const own = o.branch_id === branchId;
            return (
              <li key={o.id} className="flex items-center gap-3 p-3">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="type-body font-semibold first-letter:uppercase">
                    {o.date === today ? "Hoy" : formatDateEs(o.date)}
                  </p>
                  <p className="type-small text-muted-foreground">
                    {slotName(o.time_slot_id)} ·{" "}
                    {o.menu_id ? (
                      <span>{menuName(o.menu_id)}</span>
                    ) : (
                      <span className="font-semibold text-destructive">Cerrado</span>
                    )}
                    {o.note ? ` · ${o.note}` : ""}
                  </p>
                  {!own ? (
                    <p className="type-caption text-muted-foreground">
                      De{" "}
                      {o.branch_id
                        ? (branches.find((b) => b.id === o.branch_id)?.name ?? "otra sucursal")
                        : "todas las sucursales"}
                    </p>
                  ) : null}
                </div>
                {canEdit && own ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar la fecha especial del ${o.date}`}
                    className="text-destructive"
                    onClick={() => remove(o)}
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OverrideForm({
  today,
  slots,
  menus,
  canChooseMenu,
  onCancel,
  onSave,
}: {
  today: string;
  slots: Option[];
  menus: Option[];
  canChooseMenu: boolean;
  onCancel: () => void;
  onSave: (input: {
    date: string;
    slotId: string | null;
    menuId: string | null;
    note: string;
  }) => void;
}) {
  const [date, setDate] = useState(today);
  const [slotId, setSlotId] = useState("");
  const [menuId, setMenuId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="grid gap-4 rounded-xl border border-ring/40 bg-card p-4 shadow-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!date || date < today) return setError("Elige hoy o un día futuro.");
        setError(null);
        onSave({ date, slotId: slotId || null, menuId: menuId || null, note });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="override-date" label="Fecha">
          <Input
            id="override-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field id="override-slot" label="¿Cuándo?">
          <select
            id="override-slot"
            className={selectClass}
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
          >
            <option value="">Todo el día</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                Solo {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="override-menu"
          label="¿Qué se muestra?"
          hint={canChooseMenu ? undefined : "Mostrar otro menú es de los planes Pro y Negocio."}
        >
          <select
            id="override-menu"
            className={selectClass}
            value={menuId}
            onChange={(e) => setMenuId(e.target.value)}
          >
            <option value="">Cerrado</option>
            {menus.map((m) => (
              <option key={m.id} value={m.id} disabled={!canChooseMenu}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="override-note"
          label="Nota (opcional)"
          hint="Ej.: Feriado, Inventario, Menú navideño."
        >
          <Input
            id="override-note"
            maxLength={80}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Guardar fecha</Button>
      </div>
    </form>
  );
}
