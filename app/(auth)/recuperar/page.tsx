import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetRequestForm } from "@/features/auth/components/password-forms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ResetRequestPage() {
  return (
    <AuthCard
      title="¿Olvidaste tu contraseña?"
      subtitle="Escribe tu correo y te enviamos un enlace para crear una nueva."
    >
      <ResetRequestForm />
    </AuthCard>
  );
}
