import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Volvemos pronto", robots: { index: false } };

const DEFAULT_MESSAGE = "Estamos haciendo mejoras. Volvemos en unos minutos.";

/** El proxy reescribe aquí (503) cuando platform_settings.maintenance_mode está activo. */
export default function MaintenancePage() {
  return (
    <main className="grid min-h-dvh place-content-center gap-4 px-4 text-center">
      <Logo className="justify-center" />
      <h1 className="type-h1">Volvemos pronto</h1>
      <Suspense fallback={<p className="type-body text-muted-foreground">{DEFAULT_MESSAGE}</p>}>
        <Message />
      </Suspense>
    </main>
  );
}

async function Message() {
  const raw = (await headers()).get("x-maintenance-message");
  const message = raw ? decodeURIComponent(raw) : "";
  return <p className="type-body max-w-md text-muted-foreground">{message || DEFAULT_MESSAGE}</p>;
}
