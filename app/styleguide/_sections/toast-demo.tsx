"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BankAccountCard } from "@/features/payments/components/bank-account-card";

/** Demos de toasts (éxito, error, informativo, deshacer) y de la cuenta para transferencia. */
export function ToastDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-wrap content-start gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => toast.success("¡Listo! Agregamos tu Desayuno chapín 🍳")}
        >
          Toast de éxito
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => toast.error("No pudimos guardar la foto. Probemos otra vez.")}
        >
          Toast de error
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => toast("Tu pedido se programó para mañana a las 07:30.")}
        >
          Toast informativo
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            toast("Producto eliminado", {
              duration: 6000,
              action: {
                label: "Deshacer",
                onClick: () => toast.success("Recuperamos el producto."),
              },
            })
          }
        >
          Toast con Deshacer
        </Button>
      </div>
      <BankAccountCard
        account={{
          bank_name: "Banco Industrial",
          account_type: "Monetaria",
          account_number: "000-000000-0",
          holder_name: "Café El Portal, S.A.",
          instructions: "Envía tu comprobante por WhatsApp con tu número de pedido.",
        }}
      />
    </div>
  );
}
