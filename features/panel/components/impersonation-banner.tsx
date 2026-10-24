"use client";

import { EyeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { stopImpersonationAction } from "@/features/admin/actions";
import { runAction } from "@/lib/action-client";

/** Banner rojo mientras el soporte mira el panel del negocio (solo lectura, auditado). */
export function ImpersonationBanner({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div
      role="alert"
      className="type-small flex flex-wrap items-center gap-x-3 gap-y-1 bg-destructive px-4 py-2.5 text-white lg:px-8"
    >
      <span className="flex items-center gap-2 font-semibold">
        <EyeIcon aria-hidden className="size-4" />
        Soporte: estás viendo {businessName} en solo lectura. Queda en la auditoría.
      </span>
      <button
        type="button"
        disabled={pending}
        className="font-semibold underline underline-offset-2"
        onClick={() =>
          start(async () => {
            await runAction(() => stopImpersonationAction());
            router.push(`/admin/negocios/${businessId}`);
          })
        }
      >
        Salir
      </button>
    </div>
  );
}
