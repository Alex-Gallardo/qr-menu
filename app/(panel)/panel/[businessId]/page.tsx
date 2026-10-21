import { ArrowRightIcon, CalendarClockIcon, QrCodeIcon, UtensilsCrossedIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ALL_BRANCHES } from "@/features/panel/branch-selection";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { TodayMenuCard } from "@/features/schedule/components/today-menu-card";
import { getResolverData } from "@/features/schedule/program-server";
import { db } from "@/lib/db";
import { formatQ } from "@/lib/money";

/** Inicio: resumen de hoy de la sucursal elegida y accesos a las tareas diarias. */
export default function PanelHomePage({ params }: PageProps<"/panel/[businessId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home params={params} />
    </Suspense>
  );
}

/** Inicio del día en Guatemala (UTC-6, sin horario de verano). */
function startOfTodayGt() {
  const now = new Date();
  const gt = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return new Date(Date.UTC(gt.getUTCFullYear(), gt.getUTCMonth(), gt.getUTCDate(), 6));
}

async function Home({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  const branchIds =
    ctx.selectedBranch === ALL_BRANCHES || !ctx.selectedBranch
      ? ctx.branches.map((b) => b.id)
      : [ctx.selectedBranch];
  const branchLabel =
    ctx.selectedBranch === ALL_BRANCHES
      ? "todas tus sucursales"
      : (ctx.branches.find((b) => b.id === ctx.selectedBranch)?.name ?? "");

  const today = { business_id: businessId, branch_id: { in: branchIds } };
  const [ordersToday, pending, salesToday, products, resolver] = await Promise.all([
    db().orders.count({ where: { ...today, created_at: { gte: startOfTodayGt() } } }),
    db().orders.count({ where: { ...today, status: { in: ["new", "accepted", "preparing"] } } }),
    db().orders.aggregate({
      where: { ...today, created_at: { gte: startOfTodayGt() }, status: { not: "cancelled" } },
      _sum: { total_cents: true },
    }),
    db().products.count({ where: { business_id: businessId, deleted_at: null } }),
    getResolverData(businessId),
  ]);

  const firstName = ctx.user.name?.split(" ")[0];
  const stats = [
    { label: "Pedidos de hoy", value: String(ordersToday) },
    { label: "Por atender", value: String(pending) },
    { label: "Ventas estimadas", value: formatQ(salesToday._sum.total_cents ?? 0) },
  ];
  const shortcuts = [
    {
      href: panelHref(businessId, "productos"),
      icon: <UtensilsCrossedIcon />,
      title: "Agotar un producto",
      text: `${products} productos en tu catálogo`,
    },
    {
      href: panelHref(businessId, "programacion"),
      icon: <CalendarClockIcon />,
      title: "Cambiar el menú de hoy",
      text: "Elige qué menú se ve en cada franja",
    },
    {
      href: panelHref(businessId, "qr"),
      icon: <QrCodeIcon />,
      title: "Compartir mi link",
      text: "QR para las mesas y texto para redes",
    },
  ];

  return (
    <PanelPage
      title={firstName ? `¡Hola, ${firstName}!` : "¡Hola!"}
      description={`Así va el día en ${branchLabel}.`}
    >
      <section aria-label="Resumen de hoy" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`rounded-lg border border-border bg-card p-4 shadow-1 ${i === 2 ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <p className="type-caption text-muted-foreground">{s.label}</p>
            <p className="type-h2 mt-1 tabular-nums">{s.value}</p>
          </div>
        ))}
      </section>

      <TodayMenuCard
        data={resolver}
        branches={ctx.branches.filter((b) => branchIds.includes(b.id))}
        now={new Date()}
        scheduleHref={panelHref(businessId, "programacion")}
      />

      <section aria-labelledby="atajos" className="grid gap-3">
        <h2 id="atajos" className="type-h3">
          Accesos rápidos
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {shortcuts.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group flex h-full items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-1 transition-shadow hover:shadow-2 active:scale-[0.98]"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-nube text-primary [&_svg]:size-5">
                  {s.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-small block font-semibold">{s.title}</span>
                  <span className="type-caption block text-muted-foreground">{s.text}</span>
                </span>
                <ArrowRightIcon
                  aria-hidden
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PanelPage>
  );
}
