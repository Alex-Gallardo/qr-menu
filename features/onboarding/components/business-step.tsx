"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, Loader2Icon, MessageCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Field, FormMessage } from "@/components/forms/field";
import { PrefixedInput } from "@/components/forms/prefixed-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/features/businesses/slug";
import { LocationPicker } from "@/features/location/components/location-picker";
import { runAction } from "@/lib/action-client";
import { BRAND } from "@/lib/brand";
import { toE164 } from "@/lib/phone";
import { checkOnboardingSlug, saveBusinessStep } from "../actions";
import { whatsappTestUrl } from "../onboarding";
import { businessStepSchema, type BusinessStep, type BusinessStepInput } from "../schemas";

/**
 * Paso 1: nombre del negocio (sugiere el link), primera sucursal con su
 * dirección y pin, y el WhatsApp que recibe pedidos con un mensaje de prueba.
 */
export function BusinessStepForm({
  initial,
  appHost,
}: {
  initial: BusinessStepInput | null;
  /** "qrmenu.app" para mostrar el link completo. */
  appHost: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  // El link sigue al nombre hasta que lo edita a mano (o si ya existía).
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const form = useForm<BusinessStepInput, unknown, BusinessStep>({
    resolver: zodResolver(businessStepSchema),
    defaultValues: initial ?? {
      name: "",
      slug: "",
      branchName: "",
      address: "",
      addressReference: "",
      city: "Ciudad de Guatemala",
      location: null,
      whatsapp: "",
    },
  });
  const { errors } = form.formState;
  const [name, slug, whatsapp] = useWatch({
    control: form.control,
    name: ["name", "slug", "whatsapp"],
  });
  const slugCheck = useSlugCheck(slug ?? "", initial?.slug ?? null);
  const e164 = toE164(whatsapp);

  useEffect(() => {
    if (!slugTouched) form.setValue("slug", slugify(name ?? ""), { shouldValidate: false });
  }, [name, slugTouched, form]);

  const onSubmit = form.handleSubmit(() =>
    startSave(async () => {
      setError(null);
      const res = await runAction(() => saveBusinessStep(form.getValues()));
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.push("/onboarding?paso=2");
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
        <h2 className="type-h3">Nombre y link</h2>
        <Field id="name" label="Nombre del negocio" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="organization"
            placeholder="Café El Portal"
            aria-invalid={!!errors.name}
            {...form.register("name")}
          />
        </Field>
        <Field
          id="slug"
          label="Link de tu menú"
          error={errors.slug?.message}
          hint={
            slugCheck.state === "checking" ? (
              <span className="flex items-center gap-1.5">
                <Loader2Icon aria-hidden className="size-4 animate-spin" />
                Revisando…
              </span>
            ) : slugCheck.state === "ok" ? (
              <span className="flex items-center gap-1.5 text-success">
                <CheckIcon aria-hidden className="size-4" />
                {appHost}/{slug} está disponible.
              </span>
            ) : slugCheck.state === "taken" ? (
              <span className="text-destructive">{slugCheck.message}</span>
            ) : (
              "Así te encuentran tus clientes. Solo minúsculas, números y guiones."
            )
          }
        >
          <PrefixedInput
            id="slug"
            prefix={`${appHost}/`}
            autoCapitalize="none"
            spellCheck={false}
            invalid={!!errors.slug || slugCheck.state === "taken"}
            {...form.register("slug", { onChange: () => setSlugTouched(true) })}
          />
        </Field>
      </section>

      <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
        <div className="grid gap-1">
          <h2 className="type-h3">Tu primera sucursal</h2>
          <p className="type-small text-muted-foreground">
            Si tienes varias, agregas las demás después en Sucursales.
          </p>
        </div>
        <Field id="branchName" label="Nombre de la sucursal" error={errors.branchName?.message}>
          <Input
            id="branchName"
            placeholder="Zona 10"
            aria-invalid={!!errors.branchName}
            {...form.register("branchName")}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="address" label="Dirección" error={errors.address?.message}>
            <Input
              id="address"
              autoComplete="street-address"
              placeholder="6a. avenida 12-34, zona 10"
              aria-invalid={!!errors.address}
              {...form.register("address")}
            />
          </Field>
          <Field id="city" label="Ciudad" error={errors.city?.message}>
            <Input id="city" autoComplete="address-level2" {...form.register("city")} />
          </Field>
        </div>
        <Field
          id="addressReference"
          label="Referencia (opcional)"
          error={errors.addressReference?.message}
        >
          <Input
            id="addressReference"
            placeholder="Frente al parque, portón negro"
            {...form.register("addressReference")}
          />
        </Field>
        <Controller
          control={form.control}
          name="location"
          render={({ field }) => (
            <LocationPicker
              value={field.value ?? null}
              onChange={field.onChange}
              label="Pin en el mapa (para los pedidos a domicilio)"
            />
          )}
        />
        <Field
          id="whatsapp"
          label="WhatsApp que recibe los pedidos"
          error={errors.whatsapp?.message}
          hint="Te mandamos los pedidos a este número. Prueba que sea el correcto."
        >
          <PrefixedInput
            id="whatsapp"
            prefix="+502"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="5555-1234"
            invalid={!!errors.whatsapp}
            {...form.register("whatsapp")}
          />
        </Field>
        <Button
          asChild={Boolean(e164)}
          type="button"
          variant="outline"
          disabled={!e164}
          className="justify-self-start"
        >
          {e164 ? (
            <a href={whatsappTestUrl(e164, BRAND.name)} target="_blank" rel="noopener noreferrer">
              <MessageCircleIcon aria-hidden />
              Enviar mensaje de prueba
            </a>
          ) : (
            <>
              <MessageCircleIcon aria-hidden />
              Enviar mensaje de prueba
            </>
          )}
        </Button>
      </section>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button
        type="submit"
        size="lg"
        loading={saving}
        disabled={slugCheck.state === "taken"}
        className="justify-self-end"
      >
        Siguiente: tu marca
      </Button>
    </form>
  );
}

type SlugState = "idle" | "checking" | "ok" | "taken";

/** Revisa el link mientras escribe (400 ms después de la última tecla). */
function useSlugCheck(value: string, saved: string | null) {
  const [state, setState] = useState<{ state: SlugState; message: string }>({
    state: "idle",
    message: "",
  });
  const [, startCheck] = useTransition();

  useEffect(() => {
    if (!value || value === saved) return;
    const timer = setTimeout(() => {
      setState({ state: "checking", message: "" });
      startCheck(async () => {
        const res = await runAction(() => checkOnboardingSlug({ slug: value }));
        if (!("available" in res)) return setState({ state: "idle", message: "" });
        setState({ state: res.available ? "ok" : "taken", message: res.message });
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [value, saved]);

  return !value || value === saved ? { state: "idle" as const, message: "" } : state;
}
