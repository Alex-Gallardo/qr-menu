"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, updatePassword } from "../actions";
import {
  newPasswordSchema,
  resetRequestSchema,
  type NewPasswordInput,
  type ResetRequestInput,
} from "../schemas";
import { useAction } from "./use-action";

export function ResetRequestForm() {
  const { run, pending, result } = useAction(requestPasswordReset);
  const form = useForm<ResetRequestInput>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });
  const { errors } = form.formState;

  if (result?.ok) return <FormMessage tone="success">{result.message}</FormMessage>;

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
      {result && !result.ok ? <FormMessage tone="error">{result.message}</FormMessage> : null}
      <Button type="submit" loading={pending} className="w-full">
        Enviarme el enlace
      </Button>
      <Link
        href="/entrar"
        className="type-small text-center font-semibold text-tomate-700 hover:underline"
      >
        Volver a entrar
      </Link>
    </form>
  );
}

export function NewPasswordForm() {
  const { run, pending, result } = useAction(updatePassword);
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit((v) => run(v))} noValidate className="grid gap-4">
      <Field id="password" label="Nueva contraseña" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
      </Field>
      <Field id="confirm" label="Repítela" error={errors.confirm?.message}>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          {...form.register("confirm")}
        />
      </Field>
      {result && !result.ok ? <FormMessage tone="error">{result.message}</FormMessage> : null}
      <Button type="submit" loading={pending} className="w-full">
        Guardar contraseña
      </Button>
    </form>
  );
}
