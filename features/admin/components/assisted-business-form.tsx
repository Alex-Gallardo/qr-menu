"use client";

import { CopyIcon, MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { PrefixedInput } from "@/components/forms/prefixed-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Choice } from "@/features/appearance/components/controls";
import { slugify } from "@/features/businesses/slug";
import { runAction } from "@/lib/action-client";
import { createAssistedBusinessAction } from "../actions";

const PLANS = [
  { value: "pro", label: "Pro" },
  { value: "negocio", label: "Negocio" },
  { value: "gratis", label: "Gratis" },
] as const;

/** Alta asistida: negocio + licencia a la medida + invitación de dueño. */
export function AssistedBusinessForm({
  appHost,
  trialDays,
  founderTrialDays,
}: {
  appHost: string;
  trialDays: number;
  founderTrialDays: number;
}) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    branchName: "",
    whatsapp: "",
    ownerEmail: "",
    planId: "pro" as (typeof PLANS)[number]["value"],
    trialDays: String(founderTrialDays),
    priceOverride: "",
    notes: "Fundador",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [done, setDone] = useState<{ businessId: string; inviteLink: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setError(null);
      const res = await runAction(() =>
        createAssistedBusinessAction({ ...form, trialDays: Number(form.trialDays) || 0 }),
      );
      if (!res.ok) return setError(res.message);
      setDone(res.data);
    });
  }

  if (done)
    return (
      <div
        role="status"
        className="grid gap-3 rounded-xl border border-success/40 bg-success/10 p-5"
      >
        <p className="type-body font-semibold">Negocio creado. Mándale este link al dueño:</p>
        <p className="type-small rounded-md bg-card px-3 py-2 font-mono break-all">
          {done.inviteLink}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void navigator.clipboard
                .writeText(done.inviteLink)
                .then(() => toast.success("Link copiado."))
                .catch(() => toast.error("No se pudo copiar."))
            }
          >
            <CopyIcon aria-hidden />
            Copiar link
          </Button>
          <Button asChild variant="whatsapp">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`¡Listo tu menú en ${appHost}! Crea tu cuenta aquí para entrar como dueño: ${done.inviteLink}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircleIcon aria-hidden />
              Mandar por WhatsApp
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/admin/negocios/${done.businessId}`}>Ver el negocio</Link>
          </Button>
        </div>
      </div>
    );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-1"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="a-name" label="Nombre del negocio">
          <Input
            id="a-name"
            value={form.name}
            onChange={(e) =>
              set({
                name: e.target.value,
                ...(slugTouched ? {} : { slug: slugify(e.target.value) }),
              })
            }
          />
        </Field>
        <Field id="a-slug" label="Link">
          <PrefixedInput
            id="a-slug"
            prefix={`${appHost}/`}
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set({ slug: e.target.value });
            }}
          />
        </Field>
        <Field id="a-branch" label="Primera sucursal">
          <Input
            id="a-branch"
            value={form.branchName}
            onChange={(e) => set({ branchName: e.target.value })}
          />
        </Field>
        <Field id="a-wa" label="WhatsApp de la sucursal">
          <PrefixedInput
            id="a-wa"
            prefix="+502"
            inputMode="tel"
            value={form.whatsapp}
            onChange={(e) => set({ whatsapp: e.target.value })}
          />
        </Field>
        <Field id="a-email" label="Correo del dueño" hint="Recibe una invitación de dueño.">
          <Input
            id="a-email"
            type="email"
            value={form.ownerEmail}
            onChange={(e) => set({ ownerEmail: e.target.value })}
          />
        </Field>
      </div>
      <Choice
        label="Plan"
        value={form.planId}
        onChange={(planId) => set({ planId })}
        options={PLANS}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="a-trial"
          label="Días de prueba"
          hint={`Normal ${trialDays}; fundador ${founderTrialDays}.`}
        >
          <Input
            id="a-trial"
            inputMode="numeric"
            value={form.trialDays}
            onChange={(e) => set({ trialDays: e.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field id="a-price" label="Precio especial (Q/mes)" hint="Vacío = el de lista.">
          <PrefixedInput
            id="a-price"
            prefix="Q"
            inputMode="numeric"
            value={form.priceOverride}
            onChange={(e) => set({ priceOverride: e.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field id="a-notes" label="Nota interna">
          <Input id="a-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" loading={pending} className="justify-self-start">
        Crear negocio
      </Button>
    </form>
  );
}
