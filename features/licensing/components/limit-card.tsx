import { MessageCircleIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Límite amable: explica qué incluye el plan y cómo crecer, con un botón para
 * escribirle a ventas por WhatsApp (o ver el plan si no hay número configurado).
 * Sin licenseHref (encargado) no hay botón de plan: el dueño es quien lo mejora.
 */
export function LimitCard({ message, licenseHref }: { message: string; licenseHref?: string }) {
  const sales = process.env.NEXT_PUBLIC_SALES_WHATSAPP?.replace(/\D/g, "");
  const text = encodeURIComponent(`Hola, quiero mejorar mi plan. ${message}`);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-maiz/60 bg-maiz/15 p-5 sm:flex-row sm:items-center">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-maiz/40 text-frijol">
        <SparklesIcon aria-hidden className="size-5" />
      </span>
      <p className="type-body flex-1 font-medium">{message}</p>
      {sales ? (
        <Button asChild variant="whatsapp" size="sm">
          <a href={`https://wa.me/${sales}?text=${text}`} target="_blank" rel="noopener noreferrer">
            <MessageCircleIcon />
            Escribirnos
          </a>
        </Button>
      ) : licenseHref ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={licenseHref}>Ver mi plan</Link>
        </Button>
      ) : null}
    </div>
  );
}
