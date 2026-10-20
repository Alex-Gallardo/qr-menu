"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMagicLink, signInWithPassword } from "../actions";
import { magicLinkSchema, signInSchema, type MagicLinkInput, type SignInInput } from "../schemas";
import { useAction } from "./use-action";

const LINK_ERRORS: Record<string, string> = {
  enlace: "Ese enlace ya no es válido o ya se usó. Pide uno nuevo.",
};

export function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const linkError = LINK_ERRORS[params.get("error") ?? ""];
  const [mode, setMode] = useState<"password" | "link">("password");

  return (
    <div className="grid gap-6">
      <div
        role="tablist"
        aria-label="Forma de entrar"
        className="grid grid-cols-2 rounded-md bg-muted p-1"
      >
        {(
          [
            ["password", "Con contraseña"],
            ["link", "Con enlace por correo"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className="type-small h-10 rounded-sm font-semibold text-muted-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-1"
          >
            {label}
          </button>
        ))}
      </div>

      {linkError ? <FormMessage tone="error">{linkError}</FormMessage> : null}
      {mode === "password" ? <PasswordForm next={next} /> : <MagicLinkForm next={next} />}

      <p className="type-small text-center text-muted-foreground">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-tomate-700 hover:underline">
          Crea tu menú gratis
        </Link>
      </p>
    </div>
  );
}

function PasswordForm({ next }: { next?: string }) {
  const { run, pending, result } = useAction(signInWithPassword);
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", next },
  });
  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit((v) => run(v))} noValidate className="grid gap-4">
      <Field id="email" label="Correo" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          {...form.register("email")}
        />
      </Field>
      <Field id="password" label="Contraseña" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
      </Field>
      <div className="-mt-1 text-right">
        <Link
          href="/recuperar"
          className="type-small font-semibold text-tomate-700 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      {result && !result.ok ? <FormMessage tone="error">{result.message}</FormMessage> : null}
      <Button type="submit" loading={pending} className="w-full">
        Entrar
      </Button>
    </form>
  );
}

function MagicLinkForm({ next }: { next?: string }) {
  const { run, pending, result } = useAction(sendMagicLink);
  const form = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "", next },
  });
  const { errors } = form.formState;

  if (result?.ok) return <FormMessage tone="success">{result.message}</FormMessage>;

  return (
    <form onSubmit={form.handleSubmit((v) => run(v))} noValidate className="grid gap-4">
      <Field
        id="link-email"
        label="Correo"
        error={errors.email?.message}
        hint="Te enviamos un enlace para entrar sin contraseña."
      >
        <Input
          id="link-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          {...form.register("email")}
        />
      </Field>
      {result && !result.ok ? <FormMessage tone="error">{result.message}</FormMessage> : null}
      <Button type="submit" loading={pending} className="w-full">
        Enviarme el enlace
      </Button>
    </form>
  );
}
