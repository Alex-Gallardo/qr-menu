"use client";

import { useState } from "react";
import { KpiGrid } from "@/features/analytics/components/analytics-view";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { DeliveryInfo } from "@/features/orders/components/delivery-info";
import { OrderCard } from "@/features/orders/components/order-card";
import type { InboxOrder } from "@/features/orders/inbox";
import type { OrderStatus } from "@/features/orders/status";
import { BranchSwitcher } from "@/features/panel/components/branch-switcher";
import { BottomTabs, SidebarNav } from "@/features/panel/components/panel-nav";
import { NAV_GROUPS } from "@/features/panel/nav";
import { ProductCatalog } from "@/features/products/components/product-catalog";
import type { CatalogProductRow } from "@/features/products/server";
import { ScheduleGrid } from "@/features/schedule/components/schedule-grid";
import { cellKey, GRID_WEEKDAYS, type Grid } from "@/features/schedule/grid";

// Fecha fija: "hace X min" igual en el servidor y en el navegador.
const NOW = new Date("2026-10-26T16:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

const BRANCHES = [
  { id: "demo-zona-1", name: "Zona 1", slug: "zona-1", isActive: true },
  { id: "demo-antigua", name: "Antigua", slug: "antigua", isActive: true },
];

type DemoOrder = InboxOrder;
const ORDERS: DemoOrder[] = (
  [
    ["new", "delivery", 2, "Ana López", "2× Desayuno chapín, 1× Café de olla", 10500, "cash"],
    ["accepted", "dine_in", 6, "Mesa 4", "1× Pepián de pollo, 2× Limonada", 9500, "cash"],
    ["preparing", "takeout", 11, "Carlos Pérez", "3× Panqueques con miel", 11400, "transfer"],
    ["ready", "takeout", 18, "Lucía Gómez", "1× Hilachas", 6000, "cash"],
    ["delivered", "dine_in", 45, "Mesa 2", "2× Atol de elote", 2400, "cash"],
    ["cancelled", "delivery", 60, "Pedro Ruiz", "1× Desayuno chapín", 4500, "cash"],
  ] as const
).map(([status, orderType, ago, name, summary, total, payment], i) => ({
  id: `demo-${i}`,
  number: 41 - i,
  status,
  orderType,
  tableLabel: orderType === "dine_in" ? name : null,
  scheduledFor: i === 2 ? new Date(NOW.getTime() + 90 * 60_000) : null,
  customerName: name,
  totalCents: total,
  payment,
  address: orderType === "delivery" ? "6a avenida 8-20, zona 1" : null,
  createdAt: minutesAgo(ago),
  branch: { id: BRANCHES[i % 2]!.id, name: BRANCHES[i % 2]!.name },
  summary,
}));

const product = (
  i: number,
  name: string,
  price: number,
  category: string,
  over: Partial<CatalogProductRow> = {},
): CatalogProductRow => ({
  id: `demo-p${i}`,
  name,
  description: null,
  category_id: category,
  price_cents: price,
  compare_at_cents: null,
  image_url: null,
  image_blurhash: null,
  tags: [],
  is_available: true,
  hidden_by_license: false,
  prep_minutes: null,
  sort: i,
  branch_settings: [],
  _count: { option_groups: 0 },
  ...over,
});

const PRODUCTS: CatalogProductRow[] = [
  product(1, "Desayuno chapín", 4500, "desayunos", {
    tags: ["popular"],
    _count: { option_groups: 2 },
  }),
  product(2, "Panqueques con miel", 3800, "desayunos", {
    branch_settings: [
      { branch_id: "demo-antigua", is_available: false, price_override_cents: null },
    ],
  }),
  product(3, "Pepián de pollo", 6500, "almuerzos", { compare_at_cents: 7500 }),
  product(4, "Hilachas", 6000, "almuerzos", { is_available: false }),
  product(5, "Café de olla", 1500, "bebidas"),
];

const MENUS = [
  { id: "desayuno", name: "Desayuno" },
  { id: "almuerzo", name: "Almuerzo del día" },
  { id: "fin", name: "Fin de semana" },
];
const SLOTS = [
  { id: "manana", name: "Mañana", start_time: "06:30", end_time: "11:00" },
  { id: "tarde", name: "Mediodía", start_time: "11:00", end_time: "16:00" },
];
const GRID: Grid = Object.fromEntries(
  GRID_WEEKDAYS.flatMap((d) => [
    [cellKey("manana", d), d === 0 || d === 6 ? "fin" : "desayuno"],
    ...(d === 0 ? [] : [[cellKey("tarde", d), d === 6 ? "fin" : "almuerzo"]]),
  ]),
);

/** Sección 12 · piezas reales del panel con datos de ejemplo (los cambios no se guardan). */
export function PanelDemo() {
  const [orders, setOrders] = useState(ORDERS);
  const advance = (id: string, to: OrderStatus) =>
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, status: to } : o)));

  return (
    <div className="grid gap-10">
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <h3 className="type-h3">Barra lateral (≥ 1024 px)</h3>
          <div className="grid gap-4 rounded-xl bg-sidebar p-3">
            <BranchSwitcher
              businessId="demo"
              branches={BRANCHES}
              selected="demo-zona-1"
              canSeeAll
            />
            <SidebarNav businessId="demo" groups={NAV_GROUPS} />
          </div>
        </div>
        <div className="grid content-start gap-3">
          <h3 className="type-h3">Pestañas inferiores (móvil)</h3>
          <div className="relative h-20 max-w-sm overflow-hidden rounded-xl border border-border bg-background">
            <BottomTabs businessId="demo" className="absolute lg:block" />
          </div>

          <h3 className="type-h3 mt-4">Pedidos por estado</h3>
          <p className="type-small text-muted-foreground">
            El nuevo late y tiene borde de color. El botón avanza al siguiente estado.
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                href="#panel"
                showBranch
                now={NOW}
                onAdvance={(to) => advance(o.id, to)}
              />
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Detalle: entrega con mapa</h3>
        <div className="max-w-xl">
          <DeliveryInfo
            address="6a avenida 8-20, zona 1"
            addressReference="Portón negro, frente a la farmacia"
            location={{
              lat: 14.6427,
              lng: -90.5133,
              accuracyM: 12,
              source: "gps",
              distanceKm: 1.8,
            }}
          />
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Productos con disponibilidad por sucursal</h3>
        <p className="type-small text-muted-foreground">
          Aquí el servidor rechaza los cambios: al tocar un interruptor verás cómo se revierte.
        </p>
        <ProductCatalog
          businessId="demo"
          products={PRODUCTS}
          categories={[
            { id: "desayunos", name: "Desayunos" },
            { id: "almuerzos", name: "Almuerzos" },
            { id: "bebidas", name: "Bebidas" },
          ]}
          branches={BRANCHES}
          branchId={null}
          canToggleEverywhere
          productsHref="#panel"
        />
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Programación semanal</h3>
        <ScheduleGrid
          businessId="demo"
          branchId={null}
          scopeLabel="todas las sucursales"
          slots={SLOTS}
          menus={MENUS}
          generalGrid={GRID}
          initialGrid={GRID}
          canEdit={false}
        />
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">KPIs y límite del plan</h3>
        <KpiGrid
          previousLabel="la semana pasada"
          items={[
            { label: "Pedidos", value: "128", change: 12 },
            { label: "Ventas", value: "Q8,940.00", change: -4 },
            { label: "Ticket promedio", value: "Q69.84", change: 0 },
            { label: "Visitas al menú", value: "1,204", hint: "Personas distintas" },
          ]}
        />
        <LimitCard
          message="Tu plan Gratis incluye 25 productos. Con Pro tienes hasta 300."
          licenseHref="#panel"
        />
      </div>
    </div>
  );
}
