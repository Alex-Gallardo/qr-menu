import { Logo } from "@/components/brand/logo";

/** Licencia suspendida o cancelada: sin menú ni pedidos, con un mensaje amable. */
export function MenuUnavailable({ businessName }: { businessName: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[480px] content-center justify-items-center gap-4 px-6 text-center">
      <h1 className="type-h2">Menú no disponible temporalmente</h1>
      <p className="type-body text-muted-foreground">
        El menú de {businessName} no está en línea en este momento. Vuelve a intentarlo más tarde o
        contacta directamente al restaurante.
      </p>
      <div className="mt-6 opacity-60">
        <Logo />
      </div>
    </main>
  );
}
