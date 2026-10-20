"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, Loader2Icon, SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { checkSlugAvailability, updateBusinessSettings, type SlugCheck } from "../actions";
import { businessSettingsSchema, type BusinessSettingsInput } from "../schemas";
import { slugify } from "../slug";

type Props = {
  businessId: string;
  appHost: string;
  initial: Omit<BusinessSettingsInput, "businessId">;
};

export function BusinessSettingsForm({ businessId, appHost, initial }: Props) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, startSave] = useTransition();
  const [savedSlug, setSavedSlug] = useState(initial.slug);
  const form = useForm<BusinessSettingsInput>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: { businessId, ...initial },
  });
  const { errors, isDirty } = form.formState;
  const [slug, name] = useWatch({ control: form.control, name: ["slug", "name"] });
  const slugCheck = useSlugCheck(businessId, slug ?? "", savedSlug);

  const onSubmit = form.handleSubmit((values) =>
    startSave(async () => {
      setResult(null);
      const res = await updateBusinessSettings(values);
      setResult(res);
      if (res.ok) {
        setSavedSlug(values.slug.trim().toLowerCase());
        form.reset(values);
      }
    }),
  );

  const slugChanged = (slug ?? "").trim().toLowerCase() !== savedSlug;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8">
      <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
        <h2 className="type-h3">Tu negocio</h2>
        <Field id="name" label="Nombre" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="organization"
            aria-invalid={!!errors.name}
            {...form.register("name")}
          />
        </Field>

        <Field
          id="slug"
          label="Link de tu menú"
          error={errors.slug?.message}
          hint={<SlugStatus check={slugCheck} unchanged={!slugChanged} />}
        >
          <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
            <span className="type-small flex shrink-0 items-center bg-muted px-3 text-muted-foreground">
              {appHost}/
            </span>
            <input
              id="slug"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={!!errors.slug || slugCheck.state === "taken"}
              className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
              {...form.register("slug", {
                setValueAs: (v: string) => v.toLowerCase().replace(/\s+/g, "-"),
              })}
            />
          </div>
        </Field>
        <div className="-mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => form.setValue("slug", slugify(name ?? ""), { shouldDirty: true })}
          >
            <SparklesIcon />
            Sugerir desde el nombre
          </Button>
        </div>
        {slugChanged && savedSlug ? (
          <p className="type-small flex gap-2 rounded-md bg-maiz/20 px-4 py-3">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Al guardar,{" "}
              <strong>
                {appHost}/{savedSlug}
              </strong>{" "}
              deja de funcionar: actualiza el link en tu Instagram y estados. Tus QR impresos siguen
              funcionando.
            </span>
          </p>
        ) : null}

        <Field
          id="description"
          label="Descripción"
          error={errors.description?.message}
          hint="Una frase que aparece debajo de tu nombre en el menú."
        >
          <textarea
            id="description"
            rows={3}
            aria-invalid={!!errors.description}
            className="w-full rounded-md border border-input bg-card px-4 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            {...form.register("description")}
          />
        </Field>
      </section>

      <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
        <h2 className="type-h3">Contacto y redes</h2>
        <Field
          id="email"
          label="Correo de contacto"
          error={errors.email?.message}
          hint="Si un cliente responde el correo de confirmación de su pedido, le llega aquí."
        >
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          {(
            [
              ["instagram", "Instagram"],
              ["facebook", "Facebook"],
              ["tiktok", "TikTok"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} id={key} label={label} error={errors[key]?.message}>
              <Input
                id={key}
                placeholder="@tunegocio"
                autoCapitalize="none"
                {...form.register(key)}
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
        <div>
          <h2 className="type-h3">Mensaje de WhatsApp</h2>
          <p className="type-small mt-1 text-muted-foreground">
            El saludo y la despedida que acompañan cada pedido que te envían.
          </p>
        </div>
        <Field id="whatsapp_greeting" label="Saludo" error={errors.whatsapp_greeting?.message}>
          <Input
            id="whatsapp_greeting"
            placeholder="¡Hola! Quiero hacer este pedido:"
            {...form.register("whatsapp_greeting")}
          />
        </Field>
        <Field id="whatsapp_farewell" label="Despedida" error={errors.whatsapp_farewell?.message}>
          <Input
            id="whatsapp_farewell"
            placeholder="¡Gracias!"
            {...form.register("whatsapp_farewell")}
          />
        </Field>
      </section>

      <div className="sticky bottom-16 z-10 -mx-4 grid gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-xl lg:border lg:px-5 [@media(max-height:500px)]:static">
        {result ? (
          <FormMessage tone={result.ok ? "success" : "error"}>{result.message}</FormMessage>
        ) : null}
        <Button
          type="submit"
          loading={saving}
          disabled={!isDirty || slugCheck.state === "taken" || slugCheck.state === "checking"}
          className="w-full shadow-2 sm:w-auto sm:justify-self-end"
        >
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

type SlugState = "idle" | "checking" | "ok" | "taken";

/** Revisa el link en el servidor 400 ms después de dejar de escribir. */
function useSlugCheck(businessId: string, slug: string, savedSlug: string) {
  const [state, setState] = useState<{ state: SlugState; message: string }>({
    state: "idle",
    message: "",
  });
  const [, startCheck] = useTransition();
  const value = slug.trim().toLowerCase();

  useEffect(() => {
    if (!value || value === savedSlug) return;
    const timer = setTimeout(() => {
      setState({ state: "checking", message: "Revisando…" });
      startCheck(async () => {
        const res: SlugCheck = await checkSlugAvailability({ businessId, slug: value });
        setState({ state: res.available ? "ok" : "taken", message: res.message });
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [businessId, value, savedSlug]);

  return !value || value === savedSlug ? { state: "idle" as const, message: "" } : state;
}

function SlugStatus({
  check,
  unchanged,
}: {
  check: { state: SlugState; message: string };
  unchanged: boolean;
}) {
  if (unchanged || check.state === "idle") {
    return <>Así te encuentran tus clientes. Solo minúsculas, números y guiones.</>;
  }
  if (check.state === "checking") {
    return (
      <span className="flex items-center gap-1.5">
        <Loader2Icon aria-hidden className="size-4 animate-spin" />
        Revisando…
      </span>
    );
  }
  return (
    <span
      role="status"
      className={`flex items-center gap-1.5 font-semibold ${check.state === "ok" ? "text-success" : "text-destructive"}`}
    >
      {check.state === "ok" ? (
        <CheckIcon aria-hidden className="size-4" />
      ) : (
        <TriangleAlertIcon aria-hidden className="size-4" />
      )}
      {check.message}
    </span>
  );
}
