import { AlertTriangleIcon, ClockIcon, HourglassIcon, PauseCircleIcon } from "lucide-react";
import Link from "next/link";
import type { Entitlements } from "@/features/licensing/entitlements";
import { panelHref } from "../nav";

/** Aviso de licencia arriba del panel: prueba por terminar, gracia o suspendida. */
export function LicenseBanner({
  businessId,
  entitlements,
  isOwner,
  pendingPayment = false,
}: {
  businessId: string;
  entitlements: Entitlements;
  isOwner: boolean;
  /** Ya subió una boleta y está en verificación (guía D6: "Pago en verificación"). */
  pendingPayment?: boolean;
}) {
  const { status, daysLeft } = entitlements;
  const days = daysLeft === 1 ? "1 día" : `${daysLeft} días`;

  let tone: "info" | "warning" | "danger";
  let icon: React.ReactNode;
  let text: string;
  if (pendingPayment && status !== "suspended") {
    tone = "info";
    icon = <HourglassIcon />;
    text = "Pago en verificación: recibimos tu boleta y te avisamos aquí al revisarla.";
  } else if (status === "trial" && daysLeft !== null && daysLeft <= 7) {
    tone = "info";
    icon = <ClockIcon />;
    text = `Te quedan ${days} de prueba gratis.`;
  } else if (status === "active" && daysLeft !== null && daysLeft <= 7) {
    tone = "info";
    icon = <ClockIcon />;
    text = `Tu plan vence en ${days}.`;
  } else if (status === "grace") {
    tone = "warning";
    icon = <AlertTriangleIcon />;
    text = `Tu licencia venció: tienes ${days} para renovar antes de pasar al plan Gratis.`;
  } else if (status === "suspended") {
    tone = "danger";
    icon = <PauseCircleIcon />;
    text = "Tu cuenta está en pausa: puedes ver todo, pero no hacer cambios.";
  } else {
    return null;
  }

  const styles = {
    info: "bg-maiz/20 text-frijol",
    warning: "bg-maiz/40 text-frijol",
    danger: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <div
      role="status"
      className={`type-small flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 lg:px-8 [&_svg]:size-4 [&_svg]:shrink-0 ${styles}`}
    >
      <span className="flex items-center gap-2 font-semibold">
        {icon}
        {text}
      </span>
      {isOwner ? (
        <Link
          href={panelHref(businessId, "ajustes/licencia")}
          className="font-semibold underline underline-offset-2"
        >
          {pendingPayment ? "Ver mi plan" : "Ver cómo pagar"}
        </Link>
      ) : null}
    </div>
  );
}
