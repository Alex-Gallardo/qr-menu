"use client";

import { useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runAction } from "@/lib/action-client";
import { enrollTotp, verifyTotp, type TotpEnrollment } from "../actions";
import { useAction } from "./use-action";

type Props = { next: string } & (
  { mode: "challenge"; factorId: string } | { mode: "enroll"; factorId?: undefined }
);

/**
 * Verificación en dos pasos (TOTP). Con un factor verificado pide el código;
 * si no hay, el usuario genera su QR con un botón (el alta nunca se dispara sola).
 */
export function TwoFactorForm(props: Props) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [enrolling, startEnroll] = useTransition();

  const factorId =
    props.mode === "challenge" ? props.factorId : enrollment?.ok ? enrollment.factorId : null;

  if (props.mode === "enroll" && !enrollment?.ok) {
    return (
      <div className="grid gap-4">
        <p className="type-small text-muted-foreground">
          El super admin pide un código de tu app de autenticación (Google Authenticator, 1Password
          o Authy) cada vez que entras. Vamos a configurarlo una sola vez.
        </p>
        {enrollment && !enrollment.ok ? (
          <FormMessage tone="error">{enrollment.message}</FormMessage>
        ) : null}
        <Button
          type="button"
          loading={enrolling}
          className="w-full"
          onClick={() => startEnroll(async () => setEnrollment(await runAction(enrollTotp)))}
        >
          Generar mi código QR
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {enrollment?.ok ? (
        <div className="grid gap-3">
          <p className="type-small text-muted-foreground">
            Escanea este código con tu app de autenticación y escribe el número que te muestra.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG generado por Supabase */}
          <img
            src={enrollment.qr}
            alt="Código QR para la app de autenticación"
            className="mx-auto size-48 rounded-md bg-white p-2"
          />
          <p className="type-caption text-center text-muted-foreground">
            ¿No puedes escanear? Escribe esta clave:{" "}
            <code className="font-mono break-all text-foreground">{enrollment.secret}</code>
          </p>
        </div>
      ) : (
        <p className="type-small text-muted-foreground">
          Escribe el código de 6 números de tu app de autenticación.
        </p>
      )}
      {factorId ? (
        <CodeForm factorId={factorId} next={props.next} enrolling={!!enrollment} />
      ) : null}
    </div>
  );
}

function CodeForm({
  factorId,
  next,
  enrolling,
}: {
  factorId: string;
  next: string;
  enrolling: boolean;
}) {
  const [code, setCode] = useState("");
  const { run, pending, result } = useAction(verifyTotp);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run({ factorId, code, next });
      }}
      className="grid gap-4"
    >
      <Field id="code" label="Código">
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="text-center font-mono text-2xl tracking-[0.5em]"
          autoFocus
        />
      </Field>
      {result && !result.ok ? <FormMessage tone="error">{result.message}</FormMessage> : null}
      <Button type="submit" loading={pending} disabled={code.length !== 6} className="w-full">
        {enrolling ? "Activar y continuar" : "Verificar"}
      </Button>
    </form>
  );
}
