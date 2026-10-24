import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, LogoSymbol } from "@/components/brand/logo";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import type { PanelContext } from "../context";
import { navForRole, panelHref } from "../nav";
import { BranchSwitcher } from "./branch-switcher";
import { LicenseBanner } from "./license-banner";
import { BottomTabs, SidebarNav } from "./panel-nav";

/** Marco del panel: barra lateral (escritorio), barra superior y pestañas (móvil). */
export function PanelShell({ ctx, children }: { ctx: PanelContext; children: ReactNode }) {
  const { business, member, branches, selectedBranch, entitlements, user } = ctx;
  const isOwner = member.role === "owner";
  const switcher = (
    <BranchSwitcher
      businessId={business.id}
      branches={branches}
      selected={selectedBranch}
      canSeeAll={isOwner && branches.length > 1}
    />
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Escritorio */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col gap-5 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        <Link href={panelHref(business.id, "")} className="px-3" aria-label="Inicio del panel">
          <Logo />
        </Link>
        <div className="grid gap-2 px-1">
          <p className="type-small truncate px-2 font-semibold">{business.name}</p>
          {switcher}
        </div>
        <SidebarNav businessId={business.id} groups={navForRole(member.role)} />
        <div className="mt-auto grid gap-1 border-t border-sidebar-border px-2 pt-4">
          <p className="type-caption truncate text-muted-foreground">
            {user.name ?? user.email} · {isOwner ? "Dueño" : "Encargado"}
          </p>
          <SignOutButton />
        </div>
      </aside>

      {/* Móvil */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3 px-4 py-2">
          <Link
            href={panelHref(business.id, "")}
            aria-label="Inicio del panel"
            className="shrink-0"
          >
            <LogoSymbol className="size-8" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="type-caption truncate font-semibold text-muted-foreground">
              {business.name}
            </p>
            {switcher}
          </div>
        </div>
      </header>

      <LicenseBanner
        businessId={business.id}
        entitlements={entitlements}
        isOwner={isOwner}
        pendingPayment={ctx.pendingPayment}
      />
      <main className="pb-24 lg:pb-0">{children}</main>
      <BottomTabs businessId={business.id} />
    </div>
  );
}

/** Esqueleto con la misma forma del panel mientras llega la sesión. */
export function PanelShellSkeleton() {
  return (
    <div className="min-h-dvh animate-pulse lg:pl-64" aria-hidden>
      <div className="fixed inset-y-0 left-0 hidden w-64 border-r border-sidebar-border bg-sidebar p-5 lg:block">
        <div className="h-8 w-32 rounded-md bg-muted" />
        <div className="mt-6 h-10 rounded-md bg-muted" />
        <div className="mt-6 grid gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-9 rounded-md bg-muted" />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
        <div className="size-8 rounded-md bg-muted" />
        <div className="h-10 flex-1 rounded-md bg-muted" />
      </div>
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:px-8 lg:py-10">
        <div className="h-9 w-48 rounded-md bg-muted" />
        <div className="h-32 rounded-xl bg-muted" />
      </div>
      <div className="fixed inset-x-0 bottom-0 h-16 border-t border-border bg-card lg:hidden" />
    </div>
  );
}
