import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { NewPasswordForm } from "@/features/auth/components/password-forms";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default function NewPasswordPage() {
  return (
    <AuthCard title="Crea tu nueva contraseña">
      <NewPasswordForm />
    </AuthCard>
  );
}
