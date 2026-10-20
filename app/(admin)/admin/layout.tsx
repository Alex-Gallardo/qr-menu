import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { requirePlatformUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Super admin", robots: { index: false } };

/**
 * Equipo de la plataforma con 2FA. Cada página repite la verificación, porque los
 * layouts no se vuelven a renderizar al navegar entre páginas.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: ReactNode }) {
  await requirePlatformUser();
  return children;
}
