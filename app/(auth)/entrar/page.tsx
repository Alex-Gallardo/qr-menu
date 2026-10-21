import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, FormSkeleton } from "@/features/auth/components/auth-card";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <AuthCard title="¡Qué gusto verte!" subtitle="Entra para administrar tu menú y tus pedidos.">
      <Suspense fallback={<FormSkeleton />}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
