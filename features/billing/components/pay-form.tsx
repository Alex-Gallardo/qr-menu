"use client";

import { CheckCircle2Icon, CopyIcon, FileUpIcon, MessageCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { PrefixedInput } from "@/components/forms/prefixed-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Choice, EditorSection } from "@/features/appearance/components/controls";
import { runAction } from "@/lib/action-client";
import { uploadWithProgress } from "@/lib/images/compress";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { setLoadingProgress, withLoading } from "@/lib/loading/store";
import { centsToInput, formatQ } from "@/lib/money";
import { createReceiptUpload, submitPaymentAction } from "../actions";
import {
  amountCents,
  BILLING_PERIODS,
  PAYMENT_METHODS,
  type BillingPeriod,
  type PaidPlan,
} from "../billing";
import { prepareReceipt } from "../receipt-file";
import { paymentSchema } from "../schemas";

type Plan = { id: PaidPlan; name: string; monthlyGtq: number };
type Account = { bank: string; type: string; number: string; holder: string };

/**
 * Cómo pagar: elige plan y periodo (el monto sale solo), transfiere a una de
 * las cuentas y sube la boleta. Queda "En verificación" hasta que el admin la revisa.
 */
export function PayForm({
  businessId,
  plans,
  initialPlan,
  accounts,
  salesWhatsapp,
  periodHint,
}: {
  businessId: string;
  plans: Plan[];
  initialPlan: PaidPlan;
  accounts: Account[];
  /** Número de ventas (sin +) si no hay cuentas configuradas. */
  salesWhatsapp: string | null;
  /** "Se extiende hasta el …" por periodo (calculado en el servidor). */
  periodHint: Record<BillingPeriod, string>;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState<PaidPlan>(initialPlan);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [method, setMethod] = useState<"transfer" | "deposit">("transfer");
  const [bank, setBank] = useState("");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<{ path: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = plans.find((p) => p.id === planId) ?? plans[0]!;
  const cents = amountCents(plan.monthlyGtq, period);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const path = await withLoading("Subiendo tu boleta…", async (signal) => {
        const blob = await prepareReceipt(file);
        const type = blob.type || file.type;
        const res = await runAction(() =>
          createReceiptUpload({ businessId, type, bytes: blob.size }),
        );
        if (!res.ok) throw new Error(res.message);
        await uploadWithProgress(res.data.signedUrl, blob, (p) => setLoadingProgress(p), signal);
        return res.data.path;
      });
      setReceipt({ path, name: file.name });
    } catch (e) {
      if (!(e instanceof LoadingCancelledError))
        setError(e instanceof Error ? e.message : "No pudimos subir la boleta. Probemos otra vez.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      businessId,
      planId,
      period,
      method,
      bank,
      reference,
      amount: centsToInput(cents),
      receiptPath: receipt?.path ?? "",
    };
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
    start(async () => {
      setError(null);
      const res = await runAction(() => submitPaymentAction(parsed.data));
      if (!res.ok) return setError(res.message);
      toast.success(res.message ?? "Recibimos tu boleta.");
      setBank("");
      setReference("");
      setReceipt(null);
      router.refresh();
    });
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Número de cuenta copiado.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  return (
    <EditorSection
      title="Pagar o renovar"
      description="Por transferencia o depósito. Sube la boleta y la verificamos en horario hábil."
    >
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Choice
          label="Plan"
          value={planId}
          onChange={setPlanId}
          options={plans.map((p) => ({ value: p.id, label: `${p.name} · Q${p.monthlyGtq}/mes` }))}
        />
        <Choice
          label="Periodo"
          value={period}
          onChange={setPeriod}
          options={BILLING_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        />
        <div className="grid gap-1 rounded-lg bg-muted px-4 py-3">
          <p className="type-small text-muted-foreground">Total a pagar</p>
          <p className="type-h2 tabular-nums">{formatQ(cents)}</p>
          <p className="type-caption text-muted-foreground">{periodHint[period]}</p>
        </div>

        <div className="grid gap-2">
          <h3 className="type-small font-semibold">Cuentas para pagar</h3>
          {accounts.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {accounts.map((a) => (
                <li
                  key={`${a.bank}-${a.number}`}
                  className="grid gap-1 rounded-lg border border-border p-3"
                >
                  <p className="type-small font-semibold">
                    {a.bank}
                    {a.type ? ` · ${a.type}` : ""}
                  </p>
                  <p className="type-body flex items-center justify-between gap-2 font-mono">
                    {a.number}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copiar cuenta ${a.number}`}
                      onClick={() => void copy(a.number)}
                    >
                      <CopyIcon aria-hidden />
                    </Button>
                  </p>
                  {a.holder ? (
                    <p className="type-caption text-muted-foreground">A nombre de {a.holder}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-small rounded-md bg-maiz/15 px-3 py-2">
              Escríbenos y te pasamos los datos de la cuenta.
              {salesWhatsapp ? (
                <>
                  {" "}
                  <a
                    href={`https://api.whatsapp.com/send?phone=${salesWhatsapp}&text=${encodeURIComponent("Hola, quiero pagar mi plan. ¿Me pasan la cuenta?")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    <MessageCircleIcon aria-hidden className="size-4" />
                    WhatsApp
                  </a>
                </>
              ) : null}
            </p>
          )}
        </div>

        <Choice
          label="¿Cómo pagaste?"
          value={method}
          onChange={setMethod}
          options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pay-bank" label="Banco desde donde pagaste">
            <Input
              id="pay-bank"
              value={bank}
              placeholder="Banco Industrial"
              onChange={(e) => setBank(e.target.value)}
            />
          </Field>
          <Field id="pay-ref" label="Número de boleta o transferencia">
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>
        <Field id="pay-amount" label="Monto" hint="Sale del plan y el periodo.">
          <PrefixedInput id="pay-amount" prefix="Q" value={centsToInput(cents)} readOnly />
        </Field>

        <div className="grid gap-2">
          <span className="type-small font-semibold">Foto de la boleta</span>
          {receipt ? (
            <p className="type-small flex flex-wrap items-center gap-2">
              <CheckCircle2Icon aria-hidden className="size-4 text-success" />
              <span className="break-all">{receipt.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                Cambiar
              </Button>
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              onClick={() => fileRef.current?.click()}
            >
              <FileUpIcon aria-hidden />
              Subir foto o PDF
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            tabIndex={-1}
            aria-label="Elegir la boleta"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <p className="type-caption text-muted-foreground">
            Solo la ve nuestro equipo para verificar el pago.
          </p>
        </div>

        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button type="submit" loading={sending} className="justify-self-start">
          Enviar boleta
        </Button>
      </form>
    </EditorSection>
  );
}
