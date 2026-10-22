"use client";

import { BellRingIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/action-client";
import { sendTestPushAction, subscribeStaffPushAction } from "../actions";
import { IosInstallGuide, unsupportedMessage } from "./install-guide";
import { usePushDevice } from "./use-push-device";

const DISMISS_KEY = "qrm:push-prompt-dismissed";

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Franja sobre la bandeja: "Activar avisos de pedidos" si este dispositivo
 * todavía no los tiene. En el staff se activan aquí mismo (sucursal del
 * turno); en el panel lleva a Ajustes → Notificaciones para elegir sucursal.
 */
export function PushPrompt(props: { mode: "staff" } | { mode: "panel"; settingsHref: string }) {
  const push = usePushDevice();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const synced = useRef(false);

  // Staff: si este dispositivo ya tiene avisos, se vuelven a asociar al turno
  // actual (otra persona pudo abrir turno en la misma tablet).
  useEffect(() => {
    if (props.mode !== "staff" || !push.endpoint || synced.current) return;
    synced.current = true;
    void push.enable((subscription) => subscribeStaffPushAction({ subscription }));
  }, [props.mode, push]);

  if (push.support === "checking" || push.endpoint === undefined || push.endpoint) return null;
  if (dismissed || (push.support !== "ready" && wasDismissed())) return null;
  if (push.support === "no_key" || push.support === "unsupported") return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <BellRingIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="type-body font-semibold">Recibe un aviso con cada pedido</p>
          <p className="type-small text-muted-foreground">
            {push.support === "ready"
              ? "Suena aunque la app esté cerrada o el celular bloqueado."
              : push.support === "ios_install"
                ? "En iPhone, primero instala la app en tu pantalla de inicio."
                : unsupportedMessage(push.support)}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Ocultar" onClick={dismiss}>
          <XIcon />
        </Button>
      </div>
      {push.support === "ready" ? (
        props.mode === "staff" ? (
          <Button
            type="button"
            className="justify-self-start"
            loading={pending || push.busy}
            onClick={() =>
              startTransition(async () => {
                const result = await push.enable((subscription) =>
                  subscribeStaffPushAction({ subscription }),
                );
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                toast.success(result.message);
                const reg = await navigator.serviceWorker.getRegistration("/");
                const sub = await reg?.pushManager.getSubscription();
                if (sub) await runAction(() => sendTestPushAction({ endpoint: sub.endpoint }));
              })
            }
          >
            <BellRingIcon />
            Activar avisos de pedidos
          </Button>
        ) : (
          <Button asChild className="justify-self-start">
            <Link href={props.settingsHref}>
              <BellRingIcon />
              Activar avisos de pedidos
            </Link>
          </Button>
        )
      ) : push.support === "ios_install" ? (
        showGuide ? (
          <IosInstallGuide app={props.mode} />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() => setShowGuide(true)}
          >
            Ver cómo instalarla
          </Button>
        )
      ) : null}
    </div>
  );
}
