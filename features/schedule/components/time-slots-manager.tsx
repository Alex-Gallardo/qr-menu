"use client";

import { ClockIcon, MoonIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { EmptyState } from "@/components/feedback/empty-state";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { runAction } from "@/lib/action-client";
import { removeSlot, saveSlot, toggleSlot, undoRemoveSlot } from "../actions";
import { slotFormSchema } from "../schemas";
import {
  crossesMidnight,
  formatDuration,
  formatSlotRange,
  SLOT_KEY_LABELS,
  SLOT_PRESETS,
  slotDuration,
  slotTimeProblem,
  timelineSegments,
  type SlotKey,
} from "../slots";
import type { SlotRow } from "../server";

type Draft = {
  slotId?: string;
  key: SlotKey;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

const PRESET_KEYS = ["breakfast", "lunch", "dinner"] as const;

const selectClass =
  "h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

/**
 * Franjas del día (Desayuno, Almuerzo, Cena o personalizadas) con una línea de
 * tiempo de 24 h para ver huecos y choques de un vistazo.
 */
export function TimeSlotsManager({
  businessId,
  slots,
  canEdit,
  canAdd,
  limitNotice,
}: {
  businessId: string;
  slots: SlotRow[];
  /** Solo el dueño edita (las franjas afectan a todas las sucursales). */
  canEdit: boolean;
  /** Dentro del límite del plan. */
  canAdd: boolean;
  /** Aviso del plan cuando ya no se pueden agregar más. */
  limitNotice?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [pendingActive, setPendingActive] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const visible = slots
    .filter((s) => !hidden.includes(s.id))
    .map((s) => (s.id in pendingActive ? { ...s, is_active: pendingActive[s.id]! } : s));
  const usedKeys = new Set(visible.map((s) => s.key));

  const toggle = (slotId: string, active: boolean) => {
    setPendingActive((p) => ({ ...p, [slotId]: active }));
    startTransition(async () => {
      const res = await runAction(() => toggleSlot({ businessId, slotId, active }));
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      router.refresh();
      setPendingActive((p) => {
        const next = { ...p };
        delete next[slotId];
        return next;
      });
    });
  };

  const remove = (slot: SlotRow) => {
    // Fuera de la transición: se oculta al instante, sin esperar al servidor.
    setHidden((h) => [...h, slot.id]);
    startTransition(async () => {
      const res = await runAction(() => removeSlot({ businessId, slotId: slot.id }));
      if (!res.ok) {
        setHidden((h) => h.filter((id) => id !== slot.id));
        toast.error(res.message);
        return;
      }
      router.refresh();
      // Deshacer en vez de confirmar (6 s), como pide la guía.
      toast(
        res.data.schedules > 0
          ? `Franja eliminada junto con su programación (${res.data.schedules})`
          : "Franja eliminada",
        {
          duration: 6000,
          action: {
            label: "Deshacer",
            onClick: async () => {
              const undo = await runAction(() => undoRemoveSlot({ businessId, slotId: slot.id }));
              if (undo.ok) {
                setHidden((h) => h.filter((id) => id !== slot.id));
                toast.success(undo.message);
                router.refresh();
              } else {
                toast.error(undo.message);
              }
            },
          },
        },
      );
    });
  };

  const startNew = (key: SlotKey) => {
    const preset = key === "custom" ? null : SLOT_PRESETS[key];
    setEditing({
      key,
      name: preset?.name ?? "",
      start_time: preset?.start ?? "",
      end_time: preset?.end ?? "",
      is_active: true,
    });
  };

  return (
    <div className="grid gap-5">
      <Timeline slots={visible} />

      {visible.length === 0 && !editing ? (
        <EmptyState icon={<ClockIcon />} title="Aún no tienes franjas">
          Divide tu día en Desayuno, Almuerzo y Cena para mostrar el menú que toca a cada hora.
        </EmptyState>
      ) : null}

      <ul className="grid gap-3">
        {visible.map((slot) =>
          editing?.slotId === slot.id ? (
            <li key={slot.id}>
              <SlotForm
                businessId={businessId}
                draft={editing}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  router.refresh();
                }}
              />
            </li>
          ) : (
            <li
              key={slot.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-1"
            >
              <div
                className={cn(
                  "grid w-full min-w-0 gap-0.5 sm:w-auto sm:flex-1",
                  !slot.is_active && "opacity-60",
                )}
              >
                <p className="flex flex-wrap items-center gap-2">
                  <span className="type-body font-semibold">{slot.name}</span>
                  <span className="type-caption rounded-full bg-nube px-2 py-0.5">
                    {SLOT_KEY_LABELS[slot.key]}
                  </span>
                  {!slot.is_active ? (
                    <span className="type-caption rounded-full bg-muted px-2 py-0.5 font-semibold">
                      En pausa
                    </span>
                  ) : null}
                </p>
                <p className="type-small text-muted-foreground tabular-nums">
                  {slot.start_time}–{slot.end_time} · {formatDuration(slotDuration(slot))}
                  {crossesMidnight(slot) ? (
                    <span className="ml-1 inline-flex items-center gap-1">
                      · <MoonIcon aria-hidden className="size-3.5" /> termina al día siguiente
                    </span>
                  ) : null}
                </p>
              </div>
              {canEdit ? (
                <div className="ml-auto flex items-center gap-1">
                  <label className="mr-2 flex items-center gap-2">
                    <span className="type-small text-muted-foreground">Activa</span>
                    <Switch
                      checked={slot.is_active}
                      onCheckedChange={(v) => toggle(slot.id, v)}
                      aria-label={`${slot.name} activa`}
                    />
                  </label>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Editar ${slot.name}`}
                    onClick={() => setEditing({ ...slot, slotId: slot.id })}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Eliminar ${slot.name}`}
                    className="text-destructive"
                    onClick={() => remove(slot)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ) : null}
            </li>
          ),
        )}
      </ul>

      {editing && !editing.slotId ? (
        <SlotForm
          businessId={businessId}
          draft={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      {canEdit && !editing ? (
        canAdd ? (
          <div className="flex flex-wrap gap-2">
            {PRESET_KEYS.filter((k) => !usedKeys.has(k)).map((key) => (
              <Button key={key} variant="outline" size="sm" onClick={() => startNew(key)}>
                <PlusIcon />
                {SLOT_PRESETS[key].name} {SLOT_PRESETS[key].start}–{SLOT_PRESETS[key].end}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => startNew("custom")}>
              <PlusIcon />
              Personalizada
            </Button>
          </div>
        ) : (
          limitNotice
        )
      ) : null}

      {!canEdit ? (
        <p className="type-small text-muted-foreground">
          Las franjas valen para todas las sucursales: las edita el dueño del negocio.
        </p>
      ) : null}
    </div>
  );
}

function SlotForm({
  businessId,
  draft,
  onCancel,
  onSaved,
}: {
  businessId: string;
  draft: Draft;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const timeProblem = values.start_time && values.end_time ? slotTimeProblem(values) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = slotFormSchema.safeParse({ ...values, businessId });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setError(null);
    startSave(async () => {
      const res = await runAction(() => saveSlot(parsed.data));
      if (!res.ok) return setError(res.message);
      toast.success(res.message);
      onSaved();
    });
  };

  const id = draft.slotId ?? "new";
  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-4 rounded-xl border border-ring/40 bg-card p-4 shadow-2 sm:p-5"
    >
      <h3 className="type-h3">{draft.slotId ? `Editar ${draft.name}` : "Nueva franja"}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`slot-name-${id}`}
          label="Nombre"
          hint="Así lo ve el cliente: “Desayunos”, “Menú de la noche”."
        >
          <Input
            id={`slot-name-${id}`}
            value={values.name}
            maxLength={30}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field id={`slot-key-${id}`} label="Tipo">
          <select
            id={`slot-key-${id}`}
            className={selectClass}
            value={values.key}
            onChange={(e) => set("key", e.target.value as SlotKey)}
          >
            {(Object.keys(SLOT_KEY_LABELS) as SlotKey[]).map((k) => (
              <option key={k} value={k}>
                {SLOT_KEY_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`slot-start-${id}`} label="Empieza">
          <Input
            id={`slot-start-${id}`}
            type="time"
            step={300}
            value={values.start_time}
            onChange={(e) => set("start_time", e.target.value)}
          />
        </Field>
        <Field id={`slot-end-${id}`} label="Termina">
          <Input
            id={`slot-end-${id}`}
            type="time"
            step={300}
            value={values.end_time}
            aria-invalid={!!timeProblem}
            onChange={(e) => set("end_time", e.target.value)}
          />
        </Field>
      </div>
      <p className="type-small text-muted-foreground" aria-live="polite">
        {timeProblem ??
          (values.start_time && values.end_time
            ? `${formatSlotRange(values)} · dura ${formatDuration(slotDuration(values))}`
            : "Elige a qué hora empieza y termina.")}
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          {draft.slotId ? "Guardar franja" : "Agregar franja"}
        </Button>
      </div>
    </form>
  );
}

/** Línea de 24 h con cada franja; las pausadas se ven tenues. */
function Timeline({ slots }: { slots: SlotRow[] }) {
  return (
    <figure className="grid gap-1.5">
      <figcaption className="sr-only">
        {slots.length === 0
          ? "Sin franjas en el día."
          : `Franjas del día: ${slots.map((s) => `${s.name} ${formatSlotRange(s)}`).join("; ")}.`}
      </figcaption>
      <div aria-hidden className="relative h-10 overflow-hidden rounded-md bg-muted">
        {[6, 12, 18].map((h) => (
          <span
            key={h}
            className="absolute inset-y-0 w-px bg-border"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}
        {slots.flatMap((slot) =>
          timelineSegments(slot).map((seg, i) => (
            <span
              key={`${slot.id}-${i}`}
              title={`${slot.name} ${formatSlotRange(slot)}`}
              className={cn(
                "type-caption absolute inset-y-1 flex items-center overflow-hidden rounded-sm px-1.5 font-semibold whitespace-nowrap",
                slot.is_active
                  ? "bg-primary text-primary-foreground"
                  : "border border-dashed border-muted-foreground/50 bg-card text-muted-foreground",
              )}
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
            >
              {seg.width > 8 ? <span className="truncate">{slot.name}</span> : null}
            </span>
          )),
        )}
      </div>
      <div
        aria-hidden
        className="type-caption flex justify-between text-muted-foreground tabular-nums"
      >
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </figure>
  );
}
