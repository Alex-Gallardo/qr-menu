"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/action-client";
import { acceptInvitationAction } from "../actions";

/** "Aceptar invitación" → membresía de encargado → su panel. */
export function AcceptInvitation({ token, businessName }: { token: string; businessName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const accept = () =>
    start(async () => {
      setError(null);
      const res = await runAction(() => acceptInvitationAction({ token }));
      if (!res.ok) return setError(res.message);
      router.push(`/panel/${res.data.businessId}`);
    });

  return (
    <div className="grid gap-3">
      <p className="type-body">
        Vas a poder ver y atender los pedidos de {businessName} y manejar su menú.
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="button" loading={pending} onClick={accept}>
        Aceptar invitación
      </Button>
    </div>
  );
}
