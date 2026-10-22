"use client";

import { DeleteIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { withLoading } from "@/lib/loading/store";
import { staffPinLoginAction } from "../actions";
import { PIN_MAX, PIN_MIN } from "../pin";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"] as const;

/**
 * Teclado de PIN en la tablet autorizada, con el logo del negocio. También
 * acepta el teclado físico (dígitos, Borrar, Enter).
 */
export function PinPad({
  businessName,
  logoUrl,
  branchName,
  deviceName,
}: {
  businessName: string;
  logoUrl: string | null;
  branchName: string;
  deviceName: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = (key: string) => {
    if (busy) return;
    setError(null);
    if (key === "borrar") setPin((p) => p.slice(0, -1));
    else if (/^\d$/.test(key)) setPin((p) => (p.length < PIN_MAX ? p + key : p));
  };

  async function submit(value: string) {
    if (value.length < PIN_MIN || busy) return;
    setBusy(true);
    try {
      const result = await withLoading("Abriendo tu turno…", () => staffPinLoginAction(value));
      if (result.ok) {
        router.replace("/staff/pedidos");
        return;
      }
      setError(result.message);
      setPin("");
    } catch (e) {
      if (!(e instanceof LoadingCancelledError)) throw e;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("borrar");
      else if (e.key === "Enter") void submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-8">
      <div className="grid w-full max-w-xs justify-items-center gap-6">
        <div className="grid justify-items-center gap-2 text-center">
          <span className="relative grid size-20 place-items-center overflow-hidden rounded-full bg-card shadow-2">
            {logoUrl ? (
              <Image src={logoUrl} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <span className="font-heading text-3xl font-bold text-primary">
                {businessName.slice(0, 1)}
              </span>
            )}
          </span>
          <h1 className="type-h2">{businessName}</h1>
          <p className="type-small text-muted-foreground">
            {branchName} · {deviceName}
          </p>
        </div>

        <div className="grid justify-items-center gap-2">
          <p className="type-body font-semibold">Escribe tu PIN</p>
          <div
            aria-label={`${pin.length} dígitos escritos`}
            className="flex h-6 items-center gap-3"
          >
            {Array.from({ length: Math.max(PIN_MIN, pin.length) }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-4 rounded-full border-2 border-foreground transition-colors",
                  i < pin.length && "bg-foreground",
                )}
              />
            ))}
          </div>
          <p
            role="alert"
            className="type-small min-h-10 text-center font-semibold text-destructive"
          >
            {error}
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-3">
          {KEYS.map((key, i) =>
            key === "" ? (
              <span key={i} />
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key === "borrar" ? "Borrar" : key}
                className="type-h2 grid h-16 place-items-center rounded-xl border border-border bg-card shadow-1 transition-transform active:scale-95"
              >
                {key === "borrar" ? <DeleteIcon aria-hidden className="size-6" /> : key}
              </button>
            ),
          )}
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={pin.length < PIN_MIN}
          loading={busy}
          onClick={() => void submit(pin)}
        >
          Entrar
        </Button>
      </div>
    </main>
  );
}
