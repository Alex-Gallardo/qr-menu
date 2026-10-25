import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { ADMIN_NAV, can, ROLE_LABELS, type PlatformRole } from "@/features/admin/permissions";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requirePlatformUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Super admin", template: "%s · Super admin" },
  robots: { index: false },
};

/**
 * Equipo de la plataforma con 2FA. Cada página repite la verificación (con su
 * permiso), porque los layouts no se vuelven a renderizar al navegar.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: ReactNode }) {
  const { user, profile } = await requirePlatformUser();
  const role = profile.platform_role as PlatformRole;
  const items = ADMIN_NAV.filter((i) => can(role, i.permission)).map(({ href, label }) => ({
    href,
    label,
  }));
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Logo />
          <span className="type-caption rounded-full bg-frijol px-2.5 py-0.5 font-semibold text-white">
            Super admin · {ROLE_LABELS[role] ?? role}
          </span>
          <span className="type-small ml-auto text-muted-foreground">
            {profile.full_name ?? user.email}
          </span>
          <SignOutButton />
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <AdminNav items={items} />
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
