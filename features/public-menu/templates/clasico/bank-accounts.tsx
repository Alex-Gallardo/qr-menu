"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { formatQ } from "@/lib/money";

export type BankAccount = {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  instructions: string | null;
};

/** Cuentas para transferencia con "Copiar" (hoja de pedido y confirmación). */
export function BankAccounts({
  accounts,
  totalCents,
}: {
  accounts: BankAccount[];
  totalCents: number;
}) {
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Número de cuenta copiado");
    } catch {
      toast("No se pudo copiar; mantén presionado el número para copiarlo.");
    }
  }
  return (
    <div className="grid gap-2">
      <p className="type-small text-[var(--menu-muted)]">
        Transfiere {formatQ(totalCents)} y manda la foto de tu boleta en el chat de WhatsApp.
      </p>
      {accounts.map((a) => (
        <div
          key={a.id}
          className="grid gap-1 rounded-[calc(var(--menu-radius)*0.75)] border border-[var(--menu-line)] bg-[var(--menu-bg)] p-3"
        >
          <p className="type-small font-semibold">
            {a.bankName} · {a.accountType}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="type-body font-semibold tabular-nums select-all">
              {a.accountNumber}
            </span>
            <button
              type="button"
              onClick={() => void copy(a.accountNumber)}
              className="type-small inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--menu-line)] px-3 font-semibold"
            >
              <CopyIcon aria-hidden className="size-4" />
              Copiar
            </button>
          </div>
          <p className="type-small text-[var(--menu-muted)]">A nombre de {a.holderName}</p>
          {a.instructions ? <p className="type-small">{a.instructions}</p> : null}
        </div>
      ))}
    </div>
  );
}
