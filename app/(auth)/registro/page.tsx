import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Crea tu menú" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Crea tu menú digital"
      subtitle="Tu menú del día listo en minutos y pedidos ordenados en tu WhatsApp."
    >
      <SignUpForm />
    </AuthCard>
  );
}
