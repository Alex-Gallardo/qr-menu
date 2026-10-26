import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { requirePlatform } from "@/features/admin/access";
import { featureChoicesFrom, limitOverridesToForm } from "@/features/admin/admin";
import { LicenseEditor } from "@/features/admin/components/license-editor";
import { ManualPayment } from "@/features/admin/components/payment-review";
import { SupportTools } from "@/features/admin/components/support-tools";
import { can } from "@/features/admin/permissions";
import { getBusinessDetail } from "@/features/admin/queries";
import { EditorSection } from "@/features/appearance/components/controls";
import {
  LICENSE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  usageRows,
} from "@/features/billing/billing";
import { PlanOverview } from "@/features/billing/components/plan-overview";
import { formatDateEs, formatWhenGT, todayInGuatemala } from "@/lib/gt-time";
import { formatQ } from "@/lib/money";

export const metadata: Metadata = { title: "Negocio" };

// Ver admin/layout.tsx: el super admin siempre espera al servidor.
export const instant = false;

/** Ficha del negocio en el super admin: licencia, uso, equipo, pagos, historial y soporte. */
export default function Page({ params }: PageProps<"/admin/negocios/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Business params={params} />
    </Suspense>
  );
}

async function Business({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requirePlatform("businesses.view", `/admin/negocios/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getBusinessDetail(id);
  if (!d) notFound();
  const { business, entitlements: e } = d;
  const license = business.license;
  const role = profile.platform_role;
  const now = new Date();
  const day = (date: Date) => formatDateEs(todayInGuatemala(date), now);
  const hiddenTotal = Object.values(d.hidden).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="grid gap-1">
        <Link href="/admin/negocios" className="type-small text-muted-foreground hover:underline">
          ← Negocios
        </Link>
        <h1 className="type-h1">{business.name}</h1>
        <p className="type-body text-muted-foreground">
          /{business.slug} · {business.published ? "publicado" : "sin publicar"} · alta{" "}
          {day(business.created_at)} ·{" "}
          {business.branches[0] ? (
            <a
              href={`/${business.slug}/${business.branches[0].slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              ver menú
            </a>
          ) : (
            "sin sucursales"
          )}
        </p>
        {hiddenTotal > 0 ? (
          <p className="type-small rounded-md bg-maiz/20 px-3 py-2">
            Contenido oculto por la licencia: {d.hidden.branches} sucursales, {d.hidden.products}{" "}
            productos, {d.hidden.menus} menús, {d.hidden.qr} QR, {d.hidden.staff} staff.
          </p>
        ) : null}
      </div>

      <PlanOverview
        planName={d.plans.find((p) => p.id === e.planId)?.name ?? e.planId}
        statusLabel={`${LICENSE_STATUS_LABELS[e.status]}${license ? ` · ${license.status}` : ""}`}
        tone={
          e.status === "suspended" || e.status === "cancelled"
            ? "danger"
            : e.status === "grace"
              ? "warning"
              : "ok"
        }
        detail={
          e.endsAt
            ? `Vence el ${day(e.endsAt)}${e.status === "grace" && e.graceEndsAt ? `; gracia hasta el ${day(e.graceEndsAt)}` : ""}${license?.price_override_gtq != null ? ` · precio especial Q${license.price_override_gtq}` : ""}`
            : null
        }
        usage={usageRows(e.limits, d.usage)}
        features={e.features}
      />

      {license ? (
        <LicenseEditor
          businessId={business.id}
          planId={license.plan_id}
          status={license.status}
          plans={d.plans.map((p) => ({ id: p.id, name: `${p.name} · Q${p.price_gtq}` }))}
          terms={{
            priceOverride: license.price_override_gtq?.toString() ?? "",
            graceDays: license.grace_days,
            notes: license.notes ?? "",
          }}
          limits={limitOverridesToForm(license.limit_overrides)}
          features={featureChoicesFrom(license.feature_overrides)}
          allowed={{
            edit: can(role, "licenses.edit"),
            extend: can(role, "licenses.extend"),
            status: can(role, "licenses.status"),
          }}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <EditorSection title="Equipo">
          <ul className="grid gap-2">
            {d.members.map((m, i) => (
              <li key={i} className="type-small">
                <span className="font-semibold">{m.name ?? m.email ?? "—"}</span> ·{" "}
                {m.role === "owner" ? "dueño" : "encargado"}
                <span className="block text-muted-foreground break-all">
                  {m.email ?? ""}
                  {m.last_sign_in_at
                    ? ` · último acceso ${formatWhenGT(m.last_sign_in_at, now)}`
                    : ""}
                </span>
              </li>
            ))}
            {d.members.length === 0 ? (
              <li className="type-small text-muted-foreground">
                Sin dueño todavía (invitación pendiente).
              </li>
            ) : null}
          </ul>
        </EditorSection>
        <EditorSection title="Actividad (30 días)">
          <ul className="grid min-w-0 gap-1">
            {d.orders30.map((o) => (
              <li key={o.branch} className="type-small flex justify-between">
                <span>{o.branch}</span>
                <span className="tabular-nums">{o.orders} pedidos</span>
              </li>
            ))}
            <li className="type-small flex justify-between text-muted-foreground">
              <span>Escaneos de QR</span>
              <span className="tabular-nums">{d.scans30}</span>
            </li>
          </ul>
        </EditorSection>
      </div>

      <SupportTools
        businessId={business.id}
        canImpersonate={can(role, "businesses.impersonate")}
        canSupport={can(role, "support.access")}
        openStaffSessions={d.openStaffSessions}
      />

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <EditorSection title="Pagos">
          {license?.payments.length ? (
            <ul className="grid gap-2">
              {license.payments.map((p) => (
                <li
                  key={p.id}
                  className="type-small grid gap-0.5 rounded-md border border-border p-2"
                >
                  <span className="font-semibold">
                    {formatQ(p.amount_cents)} · {PAYMENT_STATUS_LABELS[p.status]}
                  </span>
                  <span className="text-muted-foreground">
                    {p.method} · {p.bank ?? "—"} · ref. {p.reference} · {day(p.created_at)}
                  </span>
                  {p.rejection_reason ? (
                    <span className="text-destructive">Motivo: {p.rejection_reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body text-muted-foreground">Sin pagos.</p>
          )}
          {license?.payments.some((p) => p.status === "pending") ? (
            <Link
              href="/admin/pagos"
              className="type-small font-semibold text-primary hover:underline"
            >
              Revisar en Pagos →
            </Link>
          ) : null}
        </EditorSection>
        <EditorSection title="Historial de la licencia">
          <ul className="grid min-w-0 gap-1">
            {license?.events.map((ev) => (
              <li key={ev.id} className="type-small min-w-0">
                <span className="font-semibold">{ev.type}</span>{" "}
                <span className="text-muted-foreground">· {formatWhenGT(ev.created_at, now)}</span>
                {ev.data ? (
                  <span className="block truncate text-muted-foreground">
                    {JSON.stringify(ev.data)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <Link
            href={`/admin/auditoria?negocio=${business.id}`}
            className="type-small font-semibold text-primary hover:underline"
          >
            Ver su auditoría →
          </Link>
        </EditorSection>
      </div>

      {can(role, "payments.verify") ? <ManualPayment businessId={business.id} /> : null}
    </>
  );
}
