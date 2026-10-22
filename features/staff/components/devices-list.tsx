"use client";

import { TabletSmartphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/action-client";
import { formatWhenGT } from "@/lib/gt-time";
import { revokeDeviceAction } from "../actions";

/** Dispositivos autorizados para el staff con PIN, con "Revocar". */
export function DevicesList({
  businessId,
  devices,
}: {
  businessId: string;
  devices: {
    id: string;
    name: string;
    branch: { name: string };
    lastSeenAt: Date | null;
    createdAt: Date;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);

  if (devices.length === 0)
    return (
      <p className="type-body rounded-lg border border-dashed border-border p-6 text-muted-foreground">
        Aún no hay dispositivos. Abre <strong>/staff</strong> en la tablet de la sucursal con tu
        cuenta y toca “Autorizar este dispositivo”.
      </p>
    );

  return (
    <ul className="grid gap-2">
      {devices.map((d) => (
        <li
          key={d.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <TabletSmartphoneIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="type-body font-semibold">{d.name}</p>
            <p className="type-small text-muted-foreground">
              {d.branch.name} ·{" "}
              {d.lastSeenAt
                ? `último turno ${formatWhenGT(new Date(d.lastSeenAt))}`
                : "sin turnos todavía"}
            </p>
          </div>
          {confirm === d.id ? (
            <div className="flex gap-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await runAction(() =>
                      revokeDeviceAction({ businessId, deviceId: d.id }),
                    );
                    if (result.ok) toast.success(result.message);
                    else toast.error(result.message);
                    setConfirm(null);
                    router.refresh();
                  })
                }
              >
                Sí, revocar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                No
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(d.id)}>
              Revocar
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
