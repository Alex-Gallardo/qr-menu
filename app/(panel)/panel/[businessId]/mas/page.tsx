import type { Metadata } from "next";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { NavIcon } from "@/features/panel/components/nav-icon";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { MOBILE_TABS, navForRole, panelHref } from "@/features/panel/nav";

export const metadata: Metadata = { title: "Más" };

/** "Más" (móvil): todas las secciones que no tienen pestaña propia, más la cuenta. */
export default function MorePage({ params }: PageProps<"/panel/[businessId]/mas">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <More params={params} />
    </Suspense>
  );
}

async function More({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  const tabs = new Set(MOBILE_TABS.map((t) => t.segment));
  const groups = navForRole(ctx.member.role)
    .map((g) => ({ ...g, items: g.items.filter((i) => !tabs.has(i.segment)) }))
    .filter((g) => g.items.length > 0);

  return (
    <PanelPage title="Más">
      {groups.map((group, gi) => (
        <section key={group.label ?? gi} className="grid gap-2">
          {group.label ? (
            <h2 className="type-caption px-1 font-semibold tracking-wider text-muted-foreground uppercase">
              {group.label}
            </h2>
          ) : null}
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-1">
            {group.items.map((item) => (
              <li key={item.segment}>
                <Link
                  href={panelHref(businessId, item.segment)}
                  className="flex h-14 items-center gap-3 px-4 active:bg-muted"
                >
                  <NavIcon name={item.icon} className="size-5 text-primary" />
                  <span className="type-body flex-1 font-medium">{item.label}</span>
                  <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="grid gap-2 rounded-lg border border-border bg-card p-4 shadow-1">
        <p className="type-small">
          <span className="font-semibold">{ctx.user.name ?? ctx.user.email}</span>
          <span className="text-muted-foreground">
            {" "}
            · {ctx.member.role === "owner" ? "Dueño" : "Encargado"} de {ctx.business.name}
          </span>
        </p>
        <SignOutButton label="Cerrar sesión" />
      </section>
    </PanelPage>
  );
}
