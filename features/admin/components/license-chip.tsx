import { cn } from "cn";
import { LICENSE_STATUS_LABELS } from "@/features/billing/billing";
import type { EffectiveStatus } from "@/features/licensing/entitlements";

const TONES: Record<EffectiveStatus, string> = {
  trial: "bg-nube text-frijol",
  active: "bg-success/15 text-success",
  grace: "bg-maiz/40 text-frijol",
  free: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
};

/** Estado de la licencia en el super admin: "Prueba gratis", "Activa", "En pausa"… */
export function LicenseStatusChip({
  status,
  className,
}: {
  status: EffectiveStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "type-caption inline-flex rounded-full px-2.5 py-0.5 font-semibold whitespace-nowrap",
        TONES[status],
        className,
      )}
    >
      {LICENSE_STATUS_LABELS[status]}
    </span>
  );
}
