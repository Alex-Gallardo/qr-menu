"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { EditorSection } from "@/features/appearance/components/controls";
import { runAction } from "@/lib/action-client";
import { receiptLinkAction } from "../actions";
import { PAYMENT_STATUS_LABELS } from "../billing";

type Row = {
  id: string;
  amount: string;
  /** "transferencia · Banco Industrial · ref. 12345". */
  detail: string;
  /** "15 oct → 15 nov" y la fecha en que se subió (formateados en el servidor). */
  period: string;
  sentAt: string;
  status: keyof typeof PAYMENT_STATUS_LABELS;
  rejectionReason: string | null;
};

/** Historial de pagos con su estado; el motivo si se rechazó y la boleta subida. */
export function PaymentsHistory({ businessId, rows }: { businessId: string; rows: Row[] }) {
  const [pending, start] = useTransition();

  const open = (paymentId: string) =>
    start(async () => {
      const res = await runAction(() => receiptLinkAction({ businessId, paymentId }));
      if (!res.ok) return void toast.error(res.message);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });

  return (
    <EditorSection title="Historial de pagos">
      {rows.length === 0 ? (
        <p className="type-body text-muted-foreground">Todavía no hay pagos.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-1 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="type-body font-semibold tabular-nums">{r.amount}</p>
                <span
                  className={cn(
                    "type-caption rounded-full px-2.5 py-0.5 font-semibold",
                    r.status === "pending" && "bg-maiz/30 text-frijol",
                    r.status === "verified" && "bg-success/15 text-success",
                    r.status === "rejected" && "bg-destructive/10 text-destructive",
                  )}
                >
                  {PAYMENT_STATUS_LABELS[r.status]}
                </span>
              </div>
              <p className="type-small text-muted-foreground">{r.detail}</p>
              <p className="type-small text-muted-foreground">
                {r.period} · enviado {r.sentAt}
              </p>
              {r.status === "rejected" && r.rejectionReason ? (
                <p className="type-small text-destructive">Motivo: {r.rejectionReason}</p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-start"
                disabled={pending}
                onClick={() => open(r.id)}
              >
                <ExternalLinkIcon aria-hidden />
                Ver boleta
              </Button>
            </li>
          ))}
        </ul>
      )}
    </EditorSection>
  );
}
