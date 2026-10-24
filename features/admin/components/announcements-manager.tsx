"use client";

import { useState } from "react";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EditorSection } from "@/features/appearance/components/controls";
import { deleteAnnouncementAction, saveAnnouncementAction } from "../actions";
import { useAdminAction } from "./use-admin-action";

type Row = {
  id: string;
  title: string;
  body: string;
  audience: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const empty = (today: string): Omit<Row, "id"> & { id?: string } => ({
  title: "",
  body: "",
  audience: "all",
  startsAt: today,
  endsAt: "",
  isActive: true,
});

/**
 * Anuncios en los paneles (guía "Anuncios"): título, texto, audiencia
 * (all, plan:pro, business:{id}), fechas y activo.
 */
export function AnnouncementsManager({ rows, today }: { rows: Row[]; today: string }) {
  const { pending, run } = useAdminAction();
  const [form, setForm] = useState(empty(today));
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="grid gap-6">
      <EditorSection
        title={form.id ? "Editar anuncio" : "Nuevo anuncio"}
        description='Audiencia: "all" (todos), "plan:gratis", "plan:pro", "plan:negocio" o "business:{id del negocio}".'
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="an-title" label="Título">
            <Input
              id="an-title"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <Field id="an-aud" label="Audiencia">
            <Input
              id="an-aud"
              value={form.audience}
              onChange={(e) => set({ audience: e.target.value.trim() })}
            />
          </Field>
        </div>
        <Field id="an-body" label="Texto">
          <Input id="an-body" value={form.body} onChange={(e) => set({ body: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <Field id="an-start" label="Desde">
            <Input
              id="an-start"
              type="date"
              value={form.startsAt}
              onChange={(e) => set({ startsAt: e.target.value })}
            />
          </Field>
          <Field id="an-end" label="Hasta (opcional)">
            <Input
              id="an-end"
              type="date"
              value={form.endsAt}
              onChange={(e) => set({ endsAt: e.target.value })}
            />
          </Field>
          <label className="type-body flex h-12 items-center gap-3">
            <Switch
              checked={form.isActive}
              aria-label="Activo"
              onCheckedChange={(isActive) => set({ isActive })}
            />
            Activo
          </label>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => saveAnnouncementAction(form),
                () => setForm(empty(today)),
              )
            }
          >
            {form.id ? "Guardar cambios" : "Publicar anuncio"}
          </Button>
          {form.id ? (
            <Button type="button" variant="ghost" onClick={() => setForm(empty(today))}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </EditorSection>

      <EditorSection title="Anuncios">
        {rows.length === 0 ? (
          <p className="type-body text-muted-foreground">Todavía no hay anuncios.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((a) => (
              <li key={a.id} className="grid gap-1 rounded-lg border border-border p-3">
                <p className="type-body">
                  <span className="font-semibold">{a.title}</span> {a.body}
                </p>
                <p className="type-small text-muted-foreground">
                  {a.audience} · {a.startsAt}
                  {a.endsAt ? ` → ${a.endsAt}` : ""} · {a.isActive ? "activo" : "inactivo"}
                </p>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm(a)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => deleteAnnouncementAction({ id: a.id }))}
                  >
                    Borrar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </EditorSection>
    </div>
  );
}
