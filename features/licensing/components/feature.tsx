import type { ReactNode } from "react";
import { PlanLock } from "@/features/appearance/components/controls";
import { FEATURE_LABELS, planWithFeature } from "@/features/billing/billing";
import { PLAN_CATALOG, type Feature as FeatureName } from "../plan-catalog";

/**
 * `<Feature name="video_bg">`: muestra lo de adentro si el plan incluye la
 * función; si no, la invitación a mejorar el plan (guía: "Funciones
 * bloqueadas muestran invitación").
 */
export function Feature({
  name,
  features,
  licenseHref,
  children,
  invite,
}: {
  name: FeatureName;
  /** Funciones efectivas del negocio (entitlements.features). */
  features: readonly FeatureName[];
  /** Ajustes → Mi plan; sin él (encargado) se le pide al dueño. */
  licenseHref?: string;
  children: ReactNode;
  /** Texto propio para la invitación. */
  invite?: ReactNode;
}) {
  if (features.includes(name)) return <>{children}</>;
  return (
    <FeatureInvite name={name} licenseHref={licenseHref}>
      {invite}
    </FeatureInvite>
  );
}

export function FeatureInvite({
  name,
  licenseHref,
  children,
}: {
  name: FeatureName;
  licenseHref?: string;
  children?: ReactNode;
}) {
  const plan = planWithFeature(name, PLAN_CATALOG);
  const text = children ?? (
    <>
      {FEATURE_LABELS[name]}: {plan ? `viene con el plan ${plan.name}.` : "no está en tu plan."}
    </>
  );
  return licenseHref ? (
    <PlanLock licenseHref={licenseHref}>{text}</PlanLock>
  ) : (
    <p className="type-small rounded-md bg-muted px-3 py-2 text-muted-foreground">
      {text} Pídele al dueño del negocio que mejore el plan.
    </p>
  );
}
