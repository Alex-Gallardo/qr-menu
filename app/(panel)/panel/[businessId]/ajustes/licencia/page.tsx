import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import {
  BILLING_PERIODS,
  LICENSE_STATUS_LABELS,
  nextPeriod,
  PAID_PLANS,
  PAYMENT_METHODS,
  usageRows,
  type BillingPeriod,
  type PaidPlan,
} from "@/features/billing/billing";
import { PayForm } from "@/features/billing/components/pay-form";
import { PaymentsHistory } from "@/features/billing/components/payments-history";
import { PlanOverview } from "@/features/billing/components/plan-overview";
import { getBillingPage } from "@/features/billing/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { requireOwnerPage } from "@/features/panel/context";
import { formatDateEs, todayInGuatemala } from "@/lib/gt-time";
import { formatQ } from "@/lib/money";

export const metadata: Metadata = { title: "Mi plan" };

/**
 * Ajustes → Mi plan (solo el dueño): plan, estado y vencimiento, uso contra
 * límites, funciones, cómo pagar con boleta e historial de pagos.
 */
export default function Page({ params }: PageProps<"/panel/[businessId]/ajustes/licencia">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <License params={params} />
    </Suspense>
  );
}

const day = (d: Date, now: Date) => formatDateEs(todayInGuatemala(d), now);
const short = (d: Date) =>
  new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(d)
    .replace(/\s/g, " ");

async function License({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireOwnerPage(businessId, "ajustes/licencia");
  const { entitlements: e, license, plans, accounts, usage } = await getBillingPage(businessId);
  const now = new Date();

  const plan = plans.find((p) => p.id === e.planId);
  const licensed = plans.find((p) => p.id === e.licensedPlanId);
  const days = e.daysLeft === 1 ? "1 día" : `${e.daysLeft} días`;
  const detail =
    e.status === "trial" && e.endsAt
      ? `Tu prueba de ${licensed?.name ?? "Pro"} termina el ${day(e.endsAt, now)} (en ${days}).`
      : e.status === "active" && e.endsAt
        ? `Vence el ${day(e.endsAt, now)} (en ${days}).`
        : e.status === "grace" && e.graceEndsAt
          ? `Venció. Tienes hasta el ${day(e.graceEndsAt, now)} para renovar antes de pasar a Gratis.`
          : e.status === "free" && e.licensedPlanId !== e.planId
            ? `Tu ${licensed?.name ?? "plan"} venció: usas Gratis. Lo que excede sus límites está oculto, no borrado.`
            : e.status === "suspended"
              ? "Tu cuenta está en pausa. Escríbenos para reactivarla."
              : null;
  const tone =
    e.status === "suspended" || e.status === "cancelled"
      ? "danger"
      : e.status === "grace" || (e.daysLeft !== null && e.daysLeft <= 7)
        ? "warning"
        : "ok";

  const paidPlans = PAID_PLANS.flatMap((id) => {
    const p = plans.find((x) => x.id === id);
    if (!p) return [];
    // El precio especial de la licencia aplica a su plan.
    const monthlyGtq =
      license?.plan_id === id && license.price_override_gtq !== null
        ? license.price_override_gtq
        : p.price_gtq;
    return [{ id, name: p.name, monthlyGtq }];
  });
  const initialPlan: PaidPlan = (PAID_PLANS as readonly string[]).includes(e.licensedPlanId)
    ? (e.licensedPlanId as PaidPlan)
    : "pro";
  const periodHint = Object.fromEntries(
    BILLING_PERIODS.map((p) => {
      const { end } = nextPeriod(license?.ends_at ?? null, p.value, now);
      return [p.value, `Al verificarlo, tu plan queda activo hasta el ${day(end, now)}.`];
    }),
  ) as Record<BillingPeriod, string>;
  const method = (m: string) =>
    PAYMENT_METHODS.find((x) => x.value === m)?.label.toLowerCase() ?? m;

  return (
    <PanelPage title="Mi plan" description="Tu plan, lo que incluye y cómo pagarlo.">
      <PlanOverview
        planName={plan?.name ?? e.planId}
        statusLabel={LICENSE_STATUS_LABELS[e.status]}
        tone={tone}
        detail={detail}
        usage={usageRows(e.limits, usage)}
        features={e.features}
      />
      {paidPlans.length > 0 ? (
        <PayForm
          businessId={businessId}
          plans={paidPlans}
          initialPlan={initialPlan}
          accounts={accounts}
          salesWhatsapp={process.env.NEXT_PUBLIC_SALES_WHATSAPP?.replace(/\D/g, "") || null}
          periodHint={periodHint}
        />
      ) : null}
      <PaymentsHistory
        businessId={businessId}
        rows={(license?.payments ?? []).map((p) => ({
          id: p.id,
          amount: formatQ(p.amount_cents),
          detail: [method(p.method), p.bank, `ref. ${p.reference}`].filter(Boolean).join(" · "),
          period: `${short(p.period_start)} → ${short(p.period_end)}`,
          sentAt: day(p.created_at, now),
          status: p.status,
          rejectionReason: p.rejection_reason,
        }))}
      />
    </PanelPage>
  );
}
