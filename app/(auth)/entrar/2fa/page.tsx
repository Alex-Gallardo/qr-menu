import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, FormSkeleton } from "@/features/auth/components/auth-card";
import { TwoFactorForm } from "@/features/auth/components/two-factor-form";
import { getVerifiedTotpFactorId } from "@/features/auth/queries";
import { safeNext } from "@/lib/auth/route-rules";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Verificación en dos pasos", robots: { index: false } };

export default function TwoFactorPage({ searchParams }: PageProps<"/entrar/2fa">) {
  return (
    <AuthCard
      title="Verificación en dos pasos"
      subtitle="Protegemos el super admin con un código extra."
    >
      <Suspense fallback={<FormSkeleton fields={1} />}>
        <TwoFactor searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function TwoFactor({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === "string" ? raw : null, "/admin");
  await requireUser(`/entrar/2fa?next=${encodeURIComponent(next)}`);

  const factorId = await getVerifiedTotpFactorId();
  return factorId ? (
    <TwoFactorForm mode="challenge" factorId={factorId} next={next} />
  ) : (
    <TwoFactorForm mode="enroll" next={next} />
  );
}
