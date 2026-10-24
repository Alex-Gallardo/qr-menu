"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/forms/field";
import { PrefixedInput } from "@/components/forms/prefixed-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Choice, EditorSection } from "@/features/appearance/components/controls";
import { manualPaymentAction, rejectPaymentAction, verifyPaymentAction } from "../actions";
import { useAdminAction } from "./use-admin-action";

/** Verificar (extiende la licencia) o rechazar con motivo (lo ve el negocio). */
export function PaymentReview({ paymentId }: { paymentId: string }) {
  const { pending, run } = useAdminAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => run(() => verifyPaymentAction({ paymentId }))}
        >
          <CheckIcon aria-hidden />
          Verificar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting((v) => !v)}>
          <XIcon aria-hidden />
          Rechazar
        </Button>
      </div>
      {rejecting ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field id={`r-${paymentId}`} label="Motivo (lo ve el negocio)">
            <Input
              id={`r-${paymentId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-w-64"
            />
          </Field>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending || reason.trim().length < 3}
            onClick={() => run(() => rejectPaymentAction({ paymentId, reason }))}
          >
            Rechazar pago
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Pago manual (depósito en efectivo sin boleta): queda verificado y extiende. */
export function ManualPayment({ businessId }: { businessId: string }) {
  const { pending, run } = useAdminAction();
  const [planId, setPlanId] = useState<"pro" | "negocio">("pro");
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  return (
    <EditorSection
      title="Registrar pago manual"
      description="Depósito en efectivo u otro pago sin boleta."
    >
      <Choice
        label="Plan"
        value={planId}
        onChange={setPlanId}
        options={[
          { value: "pro", label: "Pro" },
          { value: "negocio", label: "Negocio" },
        ]}
      />
      <Choice
        label="Periodo"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "monthly", label: "Mensual" },
          { value: "annual", label: "Anual" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="m-amount" label="Monto">
          <PrefixedInput
            id="m-amount"
            prefix="Q"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field id="m-ref" label="Referencia">
          <Input id="m-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
      <Button
        type="button"
        size="sm"
        className="justify-self-start"
        disabled={pending}
        onClick={() =>
          run(
            () => manualPaymentAction({ businessId, planId, period, amount, reference }),
            () => {
              setAmount("");
              setReference("");
            },
          )
        }
      >
        Registrar y extender
      </Button>
    </EditorSection>
  );
}
