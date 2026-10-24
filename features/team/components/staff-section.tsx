"use client";

import { KeyRoundIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Choice, EditorSection } from "@/features/appearance/components/controls";
import { FeatureInvite } from "@/features/licensing/components/feature";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { PIN_MAX, PIN_MIN } from "@/features/staff/pin";
import { runAction } from "@/lib/action-client";
import { changeStaffPinAction, createStaffAction, setStaffActiveAction } from "../actions";

type Branch = { id: string; name: string };
type Staff = {
  id: string;
  name: string;
  active: boolean;
  branchId: string;
  branchName: string;
  /** "último turno hoy, 9:10 a. m." (formateado en el servidor). */
  lastLogin: string;
};

const digits = (v: string) => v.replace(/\D/g, "").slice(0, PIN_MAX);

/**
 * Staff con PIN por sucursal: agregar (nombre + PIN), cambiar PIN y
 * desactivar. El PIN abre turno solo en los dispositivos de su sucursal.
 */
export function StaffSection({
  businessId,
  branches,
  staff,
  allowed,
  limitMessage,
  licenseHref,
}: {
  businessId: string;
  /** Sucursales que quien mira puede administrar. */
  branches: Branch[];
  staff: Staff[];
  /** El plan incluye staff con PIN. */
  allowed: boolean;
  limitMessage: string | null;
  licenseHref?: string;
}) {
  const router = useRouter();
  return (
    <EditorSection
      title="Staff con PIN"
      description="Para la caja y la cocina: entran con su PIN en la tablet autorizada de su sucursal y ven la bandeja de pedidos."
    >
      {!allowed ? (
        <FeatureInvite name="staff_pin" licenseHref={licenseHref} />
      ) : (
        <>
          {staff.length === 0 ? (
            <p className="type-body text-muted-foreground">Todavía no hay staff.</p>
          ) : (
            <ul className="grid gap-3">
              {staff.map((s) => (
                <StaffRow
                  key={s.id}
                  businessId={businessId}
                  staff={s}
                  showBranch={branches.length > 1}
                  onChanged={() => router.refresh()}
                />
              ))}
            </ul>
          )}
          {limitMessage ? (
            <LimitCard message={limitMessage} licenseHref={licenseHref} />
          ) : (
            <NewStaffForm
              businessId={businessId}
              branches={branches}
              onCreated={() => router.refresh()}
            />
          )}
        </>
      )}
    </EditorSection>
  );
}

function NewStaffForm({
  businessId,
  branches,
  onCreated,
}: {
  businessId: string;
  branches: Branch[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setError(null);
      const res = await runAction(() => createStaffAction({ businessId, branchId, name, pin }));
      if (!res.ok) return setError(res.message);
      toast.success(res.message);
      setName("");
      setPin("");
      onCreated();
    });
  }

  if (branches.length === 0) return null;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-border p-4">
      <h3 className="type-body font-semibold">Agregar staff</h3>
      {branches.length > 1 ? (
        <Choice
          label="Sucursal"
          value={branchId}
          onChange={setBranchId}
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="staff-name" label="Nombre" hint="Ej. Rosa - caja">
          <Input
            id="staff-name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          id="staff-pin"
          label="PIN"
          hint={`De ${PIN_MIN} a ${PIN_MAX} números. Díselo en persona.`}
        >
          <Input
            id="staff-pin"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(digits(e.target.value))}
          />
        </Field>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" loading={pending} className="justify-self-start">
        <UserPlusIcon aria-hidden />
        Agregar
      </Button>
    </form>
  );
}

function StaffRow({
  businessId,
  staff,
  showBranch,
  onChanged,
}: {
  businessId: string;
  staff: Staff;
  showBranch: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(staff.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (next: boolean) =>
    start(async () => {
      setActive(next);
      const res = await runAction(() =>
        setStaffActiveAction({ businessId, staffId: staff.id, active: next }),
      );
      if (!res.ok) {
        setActive(!next);
        return void toast.error(res.message);
      }
      toast.success(res.message);
      onChanged();
    });

  const savePin = () =>
    start(async () => {
      setError(null);
      const res = await runAction(() =>
        changeStaffPinAction({ businessId, staffId: staff.id, pin }),
      );
      if (!res.ok) return setError(res.message);
      toast.success(res.message);
      setPin("");
      setEditing(false);
    });

  return (
    <li className="grid gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="type-body font-semibold">{staff.name}</p>
          <p className="type-small text-muted-foreground">
            {[showBranch ? staff.branchName : null, staff.lastLogin].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
          <KeyRoundIcon aria-hidden />
          Cambiar PIN
        </Button>
        <label className="type-small flex items-center gap-2">
          {active ? "Activo" : "Inactivo"}
          <Switch
            checked={active}
            disabled={pending}
            aria-label={`${staff.name}: ${active ? "activo" : "inactivo"}`}
            onCheckedChange={toggle}
          />
        </label>
      </div>
      {editing ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <Field id={`pin-${staff.id}`} label="PIN nuevo" error={error ?? undefined}>
            <Input
              id={`pin-${staff.id}`}
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(digits(e.target.value))}
              className="w-36"
            />
          </Field>
          <Button type="button" size="sm" loading={pending} onClick={savePin}>
            Guardar PIN
          </Button>
        </div>
      ) : null}
    </li>
  );
}
