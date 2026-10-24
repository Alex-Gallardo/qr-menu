"use client";

import { BusinessesTable } from "@/features/admin/components/businesses-table";
import { LicenseStatusChip } from "@/features/admin/components/license-chip";
import { PaymentCard } from "@/features/admin/components/payment-card";
import { PaymentReview } from "@/features/admin/components/payment-review";
import { usageRows } from "@/features/billing/billing";
import { PlanOverview } from "@/features/billing/components/plan-overview";
import type { EffectiveStatus } from "@/features/licensing/entitlements";
import { parseLimits } from "@/features/licensing/entitlements";

const NOW = new Date("2026-10-26T16:00:00Z");
const day = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60_000);

const STATUSES: EffectiveStatus[] = ["trial", "active", "grace", "free", "suspended", "cancelled"];

const BUSINESSES = [
  ["Café El Portal", "cafe-el-portal", "negocio", "trial", 10, 128],
  ["Pupusería La Ceiba", "la-ceiba", "pro", "active", 23, 342],
  ["Tacos Don Beto", "don-beto", "pro", "grace", -2, 41],
  ["Comedor Doña Mari", "dona-mari", "gratis", null, null, 7],
  ["Heladería Polar", "polar", "pro", "suspended", -20, 0],
].map(([name, slug, plan, status, ends, orders], i) => ({
  id: `demo-${i}`,
  name: name as string,
  slug: slug as string,
  published: i !== 4,
  plan_id: plan as string,
  status: status as string | null,
  ends_at: ends === null ? null : day(ends as number),
  owner_email: `duenio${i + 1}@ejemplo.com`,
  orders_30d: orders as number,
}));

/** Sección 13 · piezas del super admin con datos de ejemplo. */
export function AdminDemo() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <h3 className="type-h3">Estados de licencia</h3>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <LicenseStatusChip key={s} status={s} />
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Tabla de negocios</h3>
        <BusinessesTable rows={BUSINESSES} now={NOW} />
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Uso contra límites</h3>
        <PlanOverview
          planName="Pro"
          statusLabel="Activa"
          tone="ok"
          detail="Vence el lunes 23 de noviembre (en 28 días)"
          usage={usageRows(
            parseLimits({
              branches: 2,
              products: 300,
              menus: 10,
              time_slots: 6,
              qr: 20,
              managers: 2,
              staff: 5,
              storage_mb: 500,
            }),
            {
              branches: 2,
              products: 187,
              menus: 4,
              time_slots: 3,
              qr: 6,
              managers: 1,
              staff: 5,
              storage_mb: 140,
            },
          )}
          features={["scheduling", "multi_branch", "preorders", "staff_pin", "analytics_full"]}
        />
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Pago por verificar</h3>
        <p className="type-small text-muted-foreground">
          Verificar o rechazar no hace nada aquí: el servidor rechaza el pago de ejemplo.
        </p>
        <ul className="grid max-w-2xl gap-3">
          <PaymentCard
            pending
            now={NOW}
            payment={{
              amount_cents: 14900,
              method: "transfer",
              bank: "Banco Industrial",
              reference: "884512",
              rejection_reason: null,
              period_start: day(0),
              period_end: day(30),
              created_at: day(-1),
              plan: "pro",
              period: "monthly",
              receiptLink: null,
              license: {
                price_override_gtq: null,
                business: { id: "demo-1", name: "Pupusería La Ceiba" },
              },
            }}
            actions={<PaymentReview paymentId="demo" />}
          />
        </ul>
      </div>
    </div>
  );
}
