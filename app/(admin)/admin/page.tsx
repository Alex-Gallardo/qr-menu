import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requirePlatformUser } from "@/lib/auth/session";

/** Provisional: el super admin completo llega en QRM-042. */
export default function AdminHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  const { user, profile } = await requirePlatformUser();
  return (
    <main className="mx-auto grid max-w-landing gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <SignOutButton />
      </header>
      <div>
        <p className="type-caption font-semibold tracking-wider text-muted-foreground uppercase">
          Super admin · {profile.platform_role}
        </p>
        <h1 className="type-h1">Hola, {profile.full_name ?? user.email}</h1>
        <p className="type-body mt-2 text-muted-foreground">
          Sesión verificada en dos pasos. Negocios, licencias y pagos llegan en QRM-042.
        </p>
      </div>
    </main>
  );
}
