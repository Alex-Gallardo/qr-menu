"use client";

import { CheckIcon, CopyIcon, LandmarkIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export type BankAccountView = {
  bank_name: string;
  account_type: string;
  account_number: string;
  holder_name: string;
  instructions: string | null;
};

/**
 * Cuenta para transferencia tal como la ve el cliente, con "Copiar" de un toque.
 * Se usa en el panel (vista previa) y en la hoja de pedido (QRM-025).
 */
export function BankAccountCard({
  account,
  className,
}: {
  account: BankAccountView;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const numberRef = useRef<HTMLParagraphElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account.account_number.replace(/\D/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Navegadores dentro de Instagram/Facebook pueden bloquear el portapapeles:
      // se deja el número seleccionado para copiarlo a mano.
      const node = numberRef.current;
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
      toast("Mantén presionado el número para copiarlo.");
    }
  };

  return (
    <div className={cn("grid gap-2 rounded-lg border border-border bg-background p-4", className)}>
      <div className="flex items-center gap-2">
        <LandmarkIcon aria-hidden className="size-4 text-muted-foreground" />
        <p className="type-small font-semibold">
          {account.bank_name} · {account.account_type}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p
          ref={numberRef}
          className="font-mono text-lg font-semibold tracking-wide tabular-nums select-all"
        >
          {account.account_number}
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={copy} aria-live="polite">
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <p className="type-small text-muted-foreground">A nombre de {account.holder_name}</p>
      {account.instructions ? <p className="type-small">{account.instructions}</p> : null}
    </div>
  );
}
