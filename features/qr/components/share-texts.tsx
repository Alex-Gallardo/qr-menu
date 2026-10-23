"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EditorSection } from "@/features/appearance/components/controls";
import { shareTexts } from "../share";

/** Link del menú y textos listos para redes, con el link de la sucursal ya puesto. */
export function ShareTexts({ businessName, menuLink }: { businessName: string; menuLink: string }) {
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copiado.`);
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  return (
    <EditorSection
      title="Compartir"
      description="El link directo del menú y textos listos para tus redes y tu lista de difusión."
    >
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2">
        <span className="type-small min-w-0 flex-1 truncate font-mono">{menuLink}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copy(menuLink, "Link")}
        >
          <CopyIcon aria-hidden />
          Copiar link
        </Button>
      </div>
      <ul className="grid gap-3">
        {shareTexts(businessName, menuLink).map((t) => (
          <li key={t.id} className="grid gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="type-small font-semibold">{t.title}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void copy(t.text, "Texto")}
              >
                <CopyIcon aria-hidden />
                Copiar
              </Button>
            </div>
            <p className="type-small whitespace-pre-line text-muted-foreground">{t.text}</p>
          </li>
        ))}
      </ul>
    </EditorSection>
  );
}
