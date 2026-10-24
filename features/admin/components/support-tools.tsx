"use client";

import { CopyIcon, EyeIcon, KeyRoundIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorSection } from "@/features/appearance/components/controls";
import { runAction } from "@/lib/action-client";
import { accessLinkAction, closeStaffSessionsAction, startImpersonationAction } from "../actions";

/**
 * Soporte (guía A4): entrar como el negocio en solo lectura (banner rojo y
 * auditoría), enlace de acceso para el dueño y cerrar sesiones de staff.
 */
export function SupportTools({
  businessId,
  canImpersonate,
  canSupport,
  openStaffSessions,
}: {
  businessId: string;
  canImpersonate: boolean;
  canSupport: boolean;
  openStaffSessions: number;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [link, setLink] = useState<{ email: string; link: string } | null>(null);
  const [pending, start] = useTransition();

  const impersonate = () =>
    start(async () => {
      const res = await runAction(() => startImpersonationAction({ businessId, reason }));
      if (!res.ok) return void toast.error(res.message);
      router.push(`/panel/${businessId}`);
    });
  const accessLink = () =>
    start(async () => {
      const res = await runAction(() => accessLinkAction({ businessId }));
      if (!res.ok) return void toast.error(res.message);
      setLink(res.data);
    });
  const closeSessions = () =>
    start(async () => {
      const res = await runAction(() => closeStaffSessionsAction({ businessId }));
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message ?? "Listo.");
    });

  return (
    <EditorSection title="Soporte">
      {canImpersonate ? (
        <div className="grid gap-2">
          <Field id="imp-reason" label="Motivo para entrar (queda en la auditoría)">
            <Input id="imp-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            disabled={pending || reason.trim().length < 3}
            onClick={impersonate}
          >
            <EyeIcon aria-hidden />
            Entrar en solo lectura
          </Button>
        </div>
      ) : null}
      {canSupport ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={accessLink}>
            <KeyRoundIcon aria-hidden />
            Enlace de acceso para el dueño
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || openStaffSessions === 0}
            onClick={closeSessions}
          >
            <LogOutIcon aria-hidden />
            Cerrar sesiones de staff ({openStaffSessions})
          </Button>
        </div>
      ) : null}
      {link ? (
        <div role="status" className="grid gap-2 rounded-lg bg-muted p-3">
          <p className="type-small">
            Enlace de un solo uso para <strong>{link.email}</strong> (mándaselo por WhatsApp):
          </p>
          <p className="type-caption font-mono break-all">{link.link}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-self-start"
            onClick={() =>
              void navigator.clipboard
                .writeText(link.link)
                .then(() => toast.success("Enlace copiado."))
                .catch(() => toast.error("No se pudo copiar."))
            }
          >
            <CopyIcon aria-hidden />
            Copiar
          </Button>
        </div>
      ) : null}
    </EditorSection>
  );
}
