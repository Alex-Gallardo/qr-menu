"use client";

import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  RocketIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { downloadBlob, qrPdf, type QrBrand, type QrItem } from "@/features/qr/render";
import { runAction } from "@/lib/action-client";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { withLoading } from "@/lib/loading/store";
import { publishStep } from "../actions";

type ChecklistItem = { key: string; label: string; hint: string; href: string; done: boolean };

/**
 * Paso 4: publicar → el menú real en un marco de celular, el PDF del QR
 * (A6, listo para el porta-QR) y la lista de lo que sigue.
 */
export function PublishStep({
  businessId,
  published,
  menuUrl,
  menuPath,
  qr,
  brand,
  checklist,
  panelHref,
}: {
  businessId: string;
  published: boolean;
  /** Link completo para compartir. */
  menuUrl: string;
  /** Ruta del menú en esta app (para el marco de celular). */
  menuPath: string;
  qr: QrItem | null;
  brand: QrBrand;
  checklist: ChecklistItem[];
  panelHref: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [publishing, startPublish] = useTransition();

  function publish() {
    startPublish(async () => {
      setError(null);
      const res = await withLoading("Publicando tu menú…", () =>
        runAction(() => publishStep({ businessId })),
      ).catch((e: unknown) => {
        if (e instanceof LoadingCancelledError) return null;
        throw e;
      });
      if (!res) return;
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  async function downloadQr() {
    if (!qr) return;
    try {
      const blob = await withLoading("Preparando tu PDF…", () => qrPdf([qr], "a6", brand));
      downloadBlob(blob, `${qr.fileName}.pdf`);
    } catch (e) {
      if (!(e instanceof LoadingCancelledError))
        toast.error("No pudimos generar el PDF. Probemos otra vez.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(menuUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="grid gap-6">
        {published ? (
          <section className="grid gap-4 rounded-xl border border-success/40 bg-success/10 p-5 sm:p-6">
            <h2 className="type-h2 flex items-center gap-2">
              <CheckCircle2Icon aria-hidden className="size-7 text-success" />
              ¡Tu menú está en línea!
            </h2>
            <p className="type-body break-all">
              <a
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {menuUrl}
              </a>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void downloadQr()} disabled={!qr}>
                <FileTextIcon aria-hidden />
                Descargar QR para imprimir (PDF)
              </Button>
              <Button type="button" variant="outline" onClick={() => void copyLink()}>
                <CopyIcon aria-hidden />
                Copiar link
              </Button>
              <Button asChild variant="ghost">
                <a href={menuPath} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon aria-hidden />
                  Ver mi menú
                </a>
              </Button>
            </div>
            <p className="type-small text-muted-foreground">
              El PDF es tamaño A6 (porta-QR de mesa). Imprímelo al 100 %, sin ajustar a la página.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
            <h2 className="type-h3">Todo listo para publicar</h2>
            <p className="type-body text-muted-foreground">
              Revisa tu menú en el celular de la derecha. Al publicar te damos tu QR para imprimir y
              tu menú aparece en Google.
            </p>
            {error ? <FormMessage tone="error">{error}</FormMessage> : null}
            <div className="flex flex-wrap justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/onboarding?paso=3")}
              >
                Atrás
              </Button>
              <Button type="button" size="lg" loading={publishing} onClick={publish}>
                <RocketIcon aria-hidden />
                Publicar mi menú
              </Button>
            </div>
          </section>
        )}

        {published ? (
          <section className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
            <h2 className="type-h3">Lo que sigue</h2>
            <ul className="grid gap-2">
              {checklist.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                  >
                    {item.done ? (
                      <CheckCircle2Icon aria-hidden className="size-5 shrink-0 text-success" />
                    ) : (
                      <CircleIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "type-small block font-semibold",
                          item.done && "text-muted-foreground line-through",
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="type-caption block text-muted-foreground">{item.hint}</span>
                    </span>
                    <ArrowRightIcon
                      aria-hidden
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="justify-self-end">
              <Link href={panelHref}>Ir a mi panel</Link>
            </Button>
          </section>
        ) : null}
      </div>

      <aside aria-label="Tu menú" className="grid justify-items-center gap-2 lg:sticky lg:top-6">
        <div className="h-[min(680px,calc(100dvh-8rem))] w-[340px] max-w-full overflow-hidden rounded-[32px] border-[10px] border-frijol bg-frijol shadow-3">
          <iframe
            src={menuPath}
            title="Tu menú en un celular"
            className="size-full rounded-[22px] bg-white"
          />
        </div>
        <p className="type-caption text-muted-foreground">Tu menú real: puedes tocarlo.</p>
      </aside>
    </div>
  );
}
