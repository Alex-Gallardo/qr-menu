"use client";

import { useState } from "react";
import { Field } from "@/components/forms/field";
import { PrefixedInput } from "@/components/forms/prefixed-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Choice, EditorSection } from "@/features/appearance/components/controls";
import { FEATURE_LABELS } from "@/features/billing/billing";
import { FEATURES, type Feature, type LimitedResource } from "@/features/licensing/plan-catalog";
import {
  changePlanAction,
  extendLicenseAction,
  setStatusAction,
  updateOverridesAction,
  updateTermsAction,
} from "../actions";
import { LIMIT_RESOURCES, type FeatureChoice } from "../admin";
import { useAdminAction } from "./use-admin-action";

/**
 * Licencia de un negocio: plan, vigencia, precio especial, días de gracia,
 * notas, límites y funciones a la medida, y suspender/reactivar/cancelar.
 */
export function LicenseEditor({
  businessId,
  planId,
  status,
  plans,
  terms,
  limits,
  features,
  allowed,
}: {
  businessId: string;
  planId: string;
  status: string;
  plans: { id: string; name: string }[];
  terms: { priceOverride: string; graceDays: number; notes: string };
  limits: Record<LimitedResource, string>;
  features: Record<Feature, FeatureChoice>;
  allowed: { edit: boolean; extend: boolean; status: boolean };
}) {
  const { pending, run } = useAdminAction();
  const [days, setDays] = useState("30");
  const [t, setT] = useState(terms);
  const [l, setL] = useState(limits);
  const [f, setF] = useState(features);
  const [reason, setReason] = useState("");

  return (
    <div className="grid gap-6">
      {allowed.edit ? (
        <EditorSection title="Plan">
          <Choice
            label="Plan base"
            value={planId}
            disabled={pending}
            onChange={(id) => run(() => changePlanAction({ businessId, planId: id }))}
            options={plans.map((p) => ({ value: p.id, label: p.name }))}
          />
          <p className="type-caption text-muted-foreground">
            A Gratis oculta lo que pasa los límites (no lo borra); a un plan pagado lo vuelve a
            mostrar.
          </p>
        </EditorSection>
      ) : null}

      {allowed.extend ? (
        <EditorSection title="Vigencia y precio">
          <div className="flex flex-wrap items-end gap-2">
            {[7, 30, 365].map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => run(() => extendLicenseAction({ businessId, days: n }))}
              >
                +{n} días
              </Button>
            ))}
            <Input
              aria-label="Días a extender"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
              className="w-24"
            />
            <Button
              type="button"
              size="sm"
              disabled={pending || !days}
              onClick={() => run(() => extendLicenseAction({ businessId, days: Number(days) }))}
            >
              Extender
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="t-price" label="Precio especial (Q/mes)" hint="Vacío = el de lista.">
              <PrefixedInput
                id="t-price"
                prefix="Q"
                inputMode="numeric"
                value={t.priceOverride}
                onChange={(e) => setT({ ...t, priceOverride: e.target.value.replace(/\D/g, "") })}
              />
            </Field>
            <Field id="t-grace" label="Días de gracia">
              <Input
                id="t-grace"
                inputMode="numeric"
                value={String(t.graceDays)}
                onChange={(e) =>
                  setT({ ...t, graceDays: Number(e.target.value.replace(/\D/g, "")) || 0 })
                }
              />
            </Field>
            <Field id="t-notes" label="Notas internas">
              <Input
                id="t-notes"
                value={t.notes}
                onChange={(e) => setT({ ...t, notes: e.target.value })}
              />
            </Field>
          </div>
          <Button
            type="button"
            size="sm"
            className="justify-self-start"
            disabled={pending}
            onClick={() => run(() => updateTermsAction({ businessId, ...t }))}
          >
            Guardar precio, gracia y notas
          </Button>
        </EditorSection>
      ) : null}

      {allowed.edit ? (
        <EditorSection
          title="Límites y funciones a la medida"
          description="Vacío = lo del plan; ∞ = ilimitado. Las funciones: del plan, sí o no."
        >
          <div className="grid gap-3 sm:grid-cols-4">
            {LIMIT_RESOURCES.map((r) => (
              <Field key={r.key} id={`l-${r.key}`} label={r.label}>
                <Input
                  id={`l-${r.key}`}
                  value={l[r.key]}
                  placeholder="plan"
                  onChange={(e) => setL({ ...l, [r.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <ul className="grid gap-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex flex-wrap items-center justify-between gap-2">
                <span className="type-small">{FEATURE_LABELS[feature]}</span>
                <select
                  aria-label={FEATURE_LABELS[feature]}
                  value={f[feature]}
                  onChange={(e) => setF({ ...f, [feature]: e.target.value as FeatureChoice })}
                  className="type-small h-10 rounded-md border border-input bg-card px-2"
                >
                  <option value="plan">Del plan</option>
                  <option value="on">Sí</option>
                  <option value="off">No</option>
                </select>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            size="sm"
            className="justify-self-start"
            disabled={pending}
            onClick={() => run(() => updateOverridesAction({ businessId, limits: l, features: f }))}
          >
            Guardar límites y funciones
          </Button>
        </EditorSection>
      ) : null}

      {allowed.status ? (
        <EditorSection
          title="Estado"
          description="Suspender deja el panel en solo lectura y el menú fuera de línea. Cancelar quita el acceso."
        >
          <Field id="s-reason" label="Motivo (queda en la auditoría)">
            <Input id="s-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {status !== "suspended" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setStatusAction({ businessId, status: "suspended", reason }),
                    () => setReason(""),
                  )
                }
              >
                Suspender
              </Button>
            ) : null}
            {status === "suspended" || status === "cancelled" ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setStatusAction({ businessId, status: "active", reason }),
                    () => setReason(""),
                  )
                }
              >
                Reactivar
              </Button>
            ) : null}
            {status !== "cancelled" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setStatusAction({ businessId, status: "cancelled", reason }),
                    () => setReason(""),
                  )
                }
              >
                Cancelar cuenta
              </Button>
            ) : null}
          </div>
        </EditorSection>
      ) : null}
    </div>
  );
}
