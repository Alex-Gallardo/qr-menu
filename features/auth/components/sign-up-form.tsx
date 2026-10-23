"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUp } from "../actions";
import { signUpSchema, type SignUpInput } from "../schemas";
import { useAction } from "./use-action";

/** `next` y `email` llegan desde una invitación de equipo (/registro?next=…&correo=…). */
export function SignUpForm({ next, email }: { next?: string; email?: string } = {}) {
  const { run, pending, result } = useAction(signUp);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: email ?? "", password: "", next },
  });
  const invited = Boolean(next?.startsWith("/invitacion/"));
  const { errors } = form.formState;

  if (result?.ok) {
    return (
      <div className="grid gap-4 text-center">
        <FormMessage tone="success">{result.message}</FormMessage>
        <Link href="/entrar" className="type-small font-semibold text-tomate-700 hover:underline">
          Volver a entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit((v) => run(v))} noValidate className="grid gap-4">
      <Field id="fullName" label="Tu nombre" error={errors.fullName?.message}>
        <Input
          id="fullName"
          autoComplete="name"
          aria-invalid={!!errors.fullName}
          {...form.register("fullName")}
        />
      </Field>
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
      <Field
        id="password"
        label="Contraseña"
        error={errors.password?.message}
        hint="Mínimo 8 caracteres."
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
      </Field>
      {result && !result.ok ? <FormMessage tone="error">{result.message}</FormMessage> : null}
      <Button type="submit" loading={pending} className="w-full">
        {invited ? "Crear mi cuenta" : "Crear mi menú gratis"}
      </Button>
      {invited ? null : (
        <p className="type-caption text-center text-muted-foreground">
          14 días gratis · Sin tarjeta · Sin comisiones por pedido
        </p>
      )}
      <p className="type-small text-center text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar"}
          className="font-semibold text-tomate-700 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
