import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Modo staff", robots: { index: false } };

/** Provisional: autorizar dispositivo y teclado de PIN llegan en QRM-031. */
export default function StaffPage() {
  return (
    <main className="grid min-h-dvh place-content-center gap-4 px-4 text-center">
      <Logo className="justify-center" />
      <h1 className="type-h2">Modo staff</h1>
      <p className="type-body max-w-sm text-muted-foreground">
        Aquí se autoriza la tablet de la sucursal y el equipo entra con su PIN. Disponible muy
        pronto.
      </p>
    </main>
  );
}
