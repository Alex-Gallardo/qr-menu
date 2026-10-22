"use client";

import { BellRingIcon, MonitorSmartphoneIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { runAction } from "@/lib/action-client";
import { removePushDeviceAction, sendTestPushAction, subscribePanelPushAction } from "../actions";
import { IosInstallGuide, unsupportedMessage } from "./install-guide";
import { usePushDevice } from "./use-push-device";

const selectClass =
  "h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const ALL = "todas";

export type PushDevice = {
  id: string;
  endpoint: string;
  branchId: string | null;
  label: string;
  /** Ya formateado en el servidor ("último aviso 11:51 a. m."). */
  detail: string;
};

/**
 * Ajustes → Notificaciones (guía §8): activar los avisos en este dispositivo
 * (con la guía de iPhone), elegir qué sucursal escuchar, enviar una prueba y
 * ver los demás dispositivos donde están activos.
 */
export function PushSettings({
  businessId,
  branches,
  allLabel,
  devices,
  inboxHref,
}: {
  businessId: string;
  branches: { id: string; name: string }[];
  /** "Todas las sucursales" (dueño) o "Todas mis sucursales" (encargado). */
  allLabel: string;
  devices: PushDevice[];
  inboxHref: string;
}) {
  const router = useRouter();
  const push = usePushDevice();
  const [pending, startTransition] = useTransition();
  const here = devices.find((d) => d.endpoint === push.endpoint) ?? null;
  const others = devices.filter((d) => d !== here);
  const [branch, setBranch] = useState<string | null>(null);
  const selected = branch ?? (here ? (here.branchId ?? ALL) : ALL);
  const branchName = (id: string | null) =>
    id ? (branches.find((b) => b.id === id)?.name ?? "Sucursal") : allLabel;

  const activate = () =>
    startTransition(async () => {
      const result = await push.enable((subscription) =>
        subscribePanelPushAction({
          businessId,
          branchId: selected === ALL ? null : selected,
          subscription,
        }),
      );
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      setBranch(null);
      router.refresh();
    });

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <BellRingIcon aria-hidden className="mt-0.5 size-6 shrink-0 text-primary" />
          <div className="grid gap-1">
            <h2 className="type-h3">Este dispositivo</h2>
            <p className="type-body text-muted-foreground">
              Te avisamos de cada pedido nuevo aunque tengas la app cerrada, y otra vez a los 3
              minutos si nadie lo acepta (hasta 3 veces). Los programados avisan también 30 minutos
              antes.
            </p>
          </div>
        </div>

        {push.support === "checking" ||
        (push.support === "ready" && push.endpoint === undefined) ? (
          <Skeleton className="h-24 w-full" />
        ) : push.support === "ios_install" ? (
          <IosInstallGuide app="panel" />
        ) : push.support !== "ready" ? (
          <p className="type-body rounded-md bg-nube px-4 py-3">
            {unsupportedMessage(push.support)}
          </p>
        ) : (
          <div className="grid gap-4">
            {here ? (
              <p className="type-body rounded-md bg-success/10 px-4 py-3">
                <strong>Avisos activados</strong> en este dispositivo · {branchName(here.branchId)}.
              </p>
            ) : null}
            {branches.length > 1 ? (
              <label className="grid gap-1.5">
                <span className="type-small font-semibold">Pedidos que quiero escuchar</span>
                <select
                  className={selectClass}
                  value={selected}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value={ALL}>{allLabel}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      Solo {b.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {!here ? (
                <Button type="button" loading={pending || push.busy} onClick={activate}>
                  <BellRingIcon />
                  Activar avisos de pedidos
                </Button>
              ) : (
                <>
                  {selected !== (here.branchId ?? ALL) ? (
                    <Button type="button" loading={pending || push.busy} onClick={activate}>
                      Guardar sucursal
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    loading={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await runAction(() =>
                          sendTestPushAction({ endpoint: here.endpoint }),
                        );
                        if (result.ok) toast.success(result.message);
                        else toast.error(result.message);
                      })
                    }
                  >
                    <SendIcon />
                    Enviar aviso de prueba
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    loading={push.busy}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await push.disable();
                        if (result.ok) toast.success(result.message);
                        else toast.error(result.message);
                        router.refresh();
                      })
                    }
                  >
                    Desactivar
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        <p className="type-small text-muted-foreground">
          El sonido con la app abierta se activa en{" "}
          <Link href={inboxHref} className="font-semibold underline">
            Pedidos
          </Link>{" "}
          con “Activar sonido”. Para una tablet de caja con PIN, activa los avisos desde la bandeja
          del staff.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="type-h3">Otros dispositivos con avisos</h2>
        {others.length === 0 ? (
          <p className="type-body rounded-lg border border-dashed border-border p-6 text-muted-foreground">
            Ninguno más. Abre el panel en tu celular, instálalo como app y activa los avisos ahí.
          </p>
        ) : (
          <ul className="grid gap-2">
            {others.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <MonitorSmartphoneIcon
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <p className="type-body font-semibold">{d.label}</p>
                  <p className="type-small text-muted-foreground">
                    {branchName(d.branchId)} · {d.detail}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await runAction(() =>
                        removePushDeviceAction({ businessId, id: d.id }),
                      );
                      if (result.ok) toast.success(result.message);
                      else toast.error(result.message);
                      router.refresh();
                    })
                  }
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
