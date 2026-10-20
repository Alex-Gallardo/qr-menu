import { LockKeyholeIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

/** Dentro del panel: sección inexistente o solo del dueño. El marco sigue visible. */
export default function PanelNotFound() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <EmptyState
        icon={<LockKeyholeIcon />}
        title="Esta sección no está disponible"
        action={
          <Button asChild variant="secondary">
            <Link href="/panel">Volver al inicio</Link>
          </Button>
        }
      >
        No existe o la maneja el dueño del negocio. Si la necesitas, pídele acceso.
      </EmptyState>
    </div>
  );
}
