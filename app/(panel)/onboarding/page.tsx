import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Configura tu negocio" };

/** Provisional: el asistente de 4 pasos llega en QRM-039. */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const user = await requireUser("/onboarding");
  return (
    <main className="mx-auto grid max-w-menu gap-6 px-4 py-10 text-center">
      <Logo className="justify-center" />
      <h1 className="type-h1">¡Bienvenido!</h1>
      <p className="type-body text-muted-foreground">
        Tu cuenta ({user.email}) está lista. Muy pronto aquí vas a configurar tu negocio en 4 pasos.
      </p>
      <div className="flex justify-center">
        <SignOutButton />
      </div>
    </main>
  );
}
