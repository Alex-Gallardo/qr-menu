"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { endShiftAction } from "../actions";

/** Barra del turno: negocio, sucursal, quién atiende y "Cerrar turno". */
export function StaffBar({
  businessName,
  branchName,
  staffName,
}: {
  businessName: string;
  branchName: string;
  staffName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
        <div className="min-w-0">
          <p className="type-small truncate font-semibold">
            {businessName} · {branchName}
          </p>
          <p className="type-caption text-muted-foreground">Turno de {staffName}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              await endShiftAction();
              router.replace("/staff");
              router.refresh();
            })
          }
        >
          <LogOutIcon />
          Cerrar turno
        </Button>
      </div>
    </header>
  );
}
