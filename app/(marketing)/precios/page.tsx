import { CheckIcon, MinusIcon } from "lucide-react";
import type { Metadata } from "next";
import { FEATURE_LABELS } from "@/features/billing/billing";
import { PricingCards, Faq } from "@/features/marketing/components/pricing";
import { FAQ, planCards } from "@/features/marketing/content";
import { getLandingData } from "@/features/marketing/server";
import { FEATURES, PLAN_CATALOG, type LimitedResource } from "@/features/licensing/plan-catalog";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Precios",
  description: `Planes de ${BRAND.name}: Gratis, Pro Q149 y Negocio Q299 al mes. Sin comisiones por pedido; pago por transferencia o depósito.`,
  alternates: { canonical: "/precios" },
};

const LIMITS: { key: LimitedResource; label: string }[] = [
  { key: "branches", label: "Sucursales" },
  { key: "products", label: "Productos" },
  { key: "menus", label: "Menús" },
  { key: "time_slots", label: "Franjas (desayuno, almuerzo…)" },
  { key: "qr", label: "Códigos QR" },
  { key: "managers", label: "Encargados" },
  { key: "staff", label: "Staff con PIN" },
  { key: "storage_mb", label: "Fotos y videos" },
];

const limitText = (key: LimitedResource, n: number | null) =>
  n === null ? "Ilimitados" : n === 0 ? "—" : key === "storage_mb" ? `${n / 1000} GB` : String(n);

/** Precios y comparación completa de los planes (desde el catálogo). */
export default async function PricingPage() {
  const data = await getLandingData();
  const plans = planCards(data.prices);
  const paymentFaq = FAQ.filter((f) => /pago|comisión|cancelo/i.test(f.q));

  return (
    <main className="mx-auto grid max-w-landing gap-12 px-4 py-12">
      <div className="grid justify-items-center gap-3 text-center">
        <h1 className="type-display">Precios</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Empieza con 14 días de Pro gratis, sin tarjeta. Sin comisiones por pedido: pagas tu plan y
          cada pedido es tuyo.
        </p>
      </div>
      <PricingCards plans={plans} />

      <section className="grid gap-4">
        <h2 className="type-h2">Comparación completa</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-3" />
                {plans.map((p) => (
                  <th
                    key={p.id}
                    scope="col"
                    className={`p-3 font-semibold ${p.highlight ? "text-tomate-700" : ""}`}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIMITS.map((l) => (
                <tr key={l.key} className="border-b border-border">
                  <th scope="row" className="p-3 text-left font-normal">
                    {l.label}
                  </th>
                  {PLAN_CATALOG.map((p) => (
                    <td key={p.id} className="p-3 tabular-nums">
                      {limitText(l.key, p.limits[l.key])}
                    </td>
                  ))}
                </tr>
              ))}
              {FEATURES.map((f) => (
                <tr key={f} className="border-b border-border last:border-0">
                  <th scope="row" className="p-3 text-left font-normal">
                    {FEATURE_LABELS[f]}
                  </th>
                  {PLAN_CATALOG.map((p) => (
                    <td key={p.id} className="p-3">
                      {p.features.includes(f) ? (
                        <CheckIcon aria-label="Incluido" className="size-4 text-aguacate" />
                      ) : (
                        <MinusIcon
                          aria-label="No incluido"
                          className="size-4 text-muted-foreground"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Negocio incluye 3 sucursales; cada sucursal extra cuesta Q99 al mes. Pedidos por WhatsApp,
          ubicación a domicilio, correo de confirmación al cliente y avisos push en todos los
          planes.
        </p>
      </section>

      <section className="grid gap-4">
        <h2 className="type-h2">Sobre el pago</h2>
        <Faq items={paymentFaq} />
      </section>
    </main>
  );
}
