import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, FormSkeleton } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { safeNext } from "@/lib/auth/route-rules";

export const metadata: Metadata = { title: "Crea tu menú" };

export default function SignUpPage({ searchParams }: PageProps<"/registro">) {
  return (
    <Suspense
      fallback={
        <AuthCard title="Crea tu cuenta">
          <FormSkeleton fields={3} />
        </AuthCard>
      }
    >
      <SignUp searchParams={searchParams} />
    </Suspense>
  );
}

async function SignUp({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const raw = typeof query.next === "string" ? query.next : null;
  const next = raw ? safeNext(raw, "") || undefined : undefined;
  const email = typeof query.correo === "string" ? query.correo.slice(0, 120) : undefined;
  const invited = Boolean(next?.startsWith("/invitacion/"));
  return (
    <AuthCard
      title={invited ? "Crea tu cuenta" : "Crea tu menú digital"}
      subtitle={
        invited
          ? "Con el correo de tu invitación; después aceptas y entras al panel."
          : "Tu menú del día listo en minutos y pedidos ordenados en tu WhatsApp."
      }
    >
      <SignUpForm next={next} email={email} />
    </AuthCard>
  );
}
