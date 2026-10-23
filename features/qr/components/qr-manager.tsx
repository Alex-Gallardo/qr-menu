"use client";

import {
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  FileTextIcon,
  ImageIcon,
  QrCodeIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Choice, EditorSection } from "@/features/appearance/components/controls";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { runAction } from "@/lib/action-client";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { withLoading } from "@/lib/loading/store";
import { createQrAction, deleteQrAction, restoreQrAction } from "../actions";
import { QR_KIND_LABELS, qrLink, type QrKind } from "../codes";
import { qrMatrix, qrSvg } from "../matrix";
import { downloadBlob, qrPdf, qrPng, qrSvgBlob, type QrBrand, type QrItem } from "../render";
import type { QrRow } from "../server";
import { ShareTexts } from "./share-texts";

type Branch = { id: string; name: string; slug: string };

const fileSlug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * QR y compartir: el QR de cada sucursal, de sus mesas y de campañas, con
 * vista previa, descargas (PDF A6/carta, PNG, SVG), escaneos y textos listos.
 */
export function QrManager({
  businessId,
  businessSlug,
  branches,
  initialBranchId,
  qrs,
  brand,
  appUrl,
  limitMessage,
  licenseHref,
}: {
  businessId: string;
  businessSlug: string;
  branches: Branch[];
  initialBranchId: string;
  qrs: QrRow[];
  brand: QrBrand;
  appUrl: string;
  /** Mensaje si el plan ya no deja crear más QR. */
  limitMessage: string | null;
  licenseHref?: string;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(initialBranchId);
  const [hidden, setHidden] = useState<string[]>([]);
  const branch = branches.find((b) => b.id === branchId) ?? branches[0]!;
  const list = qrs.filter((q) => q.branchId === branch.id && !hidden.includes(q.id));
  const hasBranchQr = list.some((q) => q.kind === "branch");
  const tables = list.filter((q) => q.kind === "table");

  const item = (q: QrRow): QrItem => ({
    link: qrLink(appUrl, q.code),
    label: q.kind === "branch" ? branch.name : q.label,
    fileName: `qr-${fileSlug(brand.businessName)}-${fileSlug(branch.name)}-${fileSlug(q.label)}`,
  });

  async function download(
    kind: "pdf-a6" | "pdf-carta" | "png" | "svg",
    items: QrItem[],
    name: string,
  ) {
    try {
      const blob = await withLoading(
        kind.startsWith("pdf") ? "Preparando tu PDF…" : "Preparando tu QR…",
        async () =>
          kind === "png"
            ? qrPng(items[0]!, brand)
            : kind === "svg"
              ? qrSvgBlob(items[0]!, brand)
              : qrPdf(items, kind === "pdf-a6" ? "a6" : "carta", brand),
      );
      downloadBlob(blob, `${name}.${kind.startsWith("pdf") ? "pdf" : kind}`);
    } catch (error) {
      if (!(error instanceof LoadingCancelledError))
        toast.error("No pudimos generar el archivo. Probemos otra vez.");
    }
  }

  async function remove(q: QrRow) {
    setHidden((h) => [...h, q.id]);
    const res = await runAction(() => deleteQrAction({ businessId, qrId: q.id }));
    if (!res.ok) {
      setHidden((h) => h.filter((id) => id !== q.id));
      toast.error(res.message);
      return;
    }
    router.refresh();
    toast(`QR "${q.label}" eliminado`, {
      duration: 6000,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const undo = await runAction(() => restoreQrAction({ businessId, qr: res.data.restore }));
          if (undo.ok) {
            setHidden((h) => h.filter((id) => id !== q.id));
            toast.success(undo.message);
            router.refresh();
          } else toast.error(undo.message);
        },
      },
    });
  }

  return (
    <div className="grid gap-6">
      {branches.length > 1 ? (
        <Choice
          label="Sucursal"
          value={branch.id}
          onChange={setBranchId}
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
        />
      ) : null}

      <EditorSection
        title={`QR de ${branch.name}`}
        description="El QR lleva a esta sucursal (y a la mesa, si es de mesa). Imprímelo en A6 para el porta-QR o en carta para la puerta. Cada escaneo se cuenta."
      >
        {list.length === 0 ? (
          <p className="type-body text-muted-foreground">
            Todavía no hay QR. Empieza con el de la sucursal o crea los de tus mesas.
          </p>
        ) : (
          <ul className="grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3">
            {list.map((q) => (
              <QrCard
                key={q.id}
                qr={q}
                item={item(q)}
                brand={brand}
                onDownload={(kind) => void download(kind, [item(q)], item(q).fileName)}
                onCopy={() => void copy(item(q).link)}
                onDelete={() => void remove(q)}
              />
            ))}
          </ul>
        )}
        {tables.length > 1 ? (
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() =>
              void download(
                "pdf-a6",
                tables.map(item),
                `qr-${fileSlug(brand.businessName)}-${fileSlug(branch.name)}-mesas`,
              )
            }
          >
            <FileTextIcon aria-hidden />
            Todas las mesas en un PDF (A6)
          </Button>
        ) : null}
      </EditorSection>

      {limitMessage ? (
        <LimitCard message={limitMessage} licenseHref={licenseHref} />
      ) : (
        <NewQrForm
          key={branch.id}
          businessId={businessId}
          branchId={branch.id}
          hasBranchQr={hasBranchQr}
          onCreated={() => router.refresh()}
        />
      )}

      <ShareTexts
        businessName={brand.businessName}
        menuLink={`${appUrl.replace(/\/+$/, "")}/${businessSlug}/${branch.slug}`}
      />
    </div>
  );
}

async function copy(text: string, label = "Link") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado.`);
  } catch {
    toast.error("No se pudo copiar.");
  }
}

function QrCard({
  qr,
  item,
  brand,
  onDownload,
  onCopy,
  onDelete,
}: {
  qr: QrRow;
  item: QrItem;
  brand: QrBrand;
  onDownload: (kind: "pdf-a6" | "pdf-carta" | "png" | "svg") => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  // Nuestro propio SVG (texto escapado en qrSvg): seguro para insertarlo.
  const svg = useMemo(
    () =>
      qrSvg({
        matrix: qrMatrix(item.link),
        color: brand.color,
        logo: { url: brand.logoUrl, letter: brand.businessName },
      }),
    [item.link, brand.color, brand.logoUrl, brand.businessName],
  );
  return (
    <li className="grid gap-3 rounded-lg border border-border bg-background p-3">
      <div
        role="img"
        aria-label={`Código QR de ${item.label}`}
        className="mx-auto aspect-square w-full max-w-48 [&_svg]:size-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="type-body truncate font-semibold">{item.label}</p>
          <p className="type-small text-muted-foreground">
            {QR_KIND_LABELS[qr.kind as QrKind]} ·{" "}
            {qr.scans === 1 ? "1 escaneo" : `${qr.scans.toLocaleString("es-GT")} escaneos`}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Más opciones de ${item.label}`}
            >
              <EllipsisVerticalIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="min-h-11" onSelect={() => onDownload("pdf-carta")}>
              <FileTextIcon aria-hidden />
              PDF tamaño carta
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={() => onDownload("svg")}>
              <QrCodeIcon aria-hidden />
              SVG (imprenta)
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={onCopy}>
              <CopyIcon aria-hidden />
              Copiar link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11 text-destructive" onSelect={onDelete}>
              <Trash2Icon aria-hidden />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="sm" onClick={() => onDownload("pdf-a6")}>
          <DownloadIcon aria-hidden />
          PDF A6
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onDownload("png")}>
          <ImageIcon aria-hidden />
          PNG
        </Button>
      </div>
    </li>
  );
}

function NewQrForm({
  businessId,
  branchId,
  hasBranchQr,
  onCreated,
}: {
  businessId: string;
  branchId: string;
  hasBranchQr: boolean;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<QrKind>(hasBranchQr ? "table" : "branch");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("10");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const input =
        kind === "branch"
          ? { businessId, branchId, kind }
          : kind === "table"
            ? { businessId, branchId, kind, from, to }
            : { businessId, branchId, kind, label };
      const res = await runAction(() => createQrAction(input));
      if (!res.ok) return setError(res.message);
      toast.success(res.message);
      setLabel("");
      if (kind === "branch") setKind("table");
      onCreated();
    });

  return (
    <EditorSection
      title="Agregar QR"
      description="Para las mesas, un QR por mesa: el pedido ya llega con su número."
    >
      <Choice
        label="¿Para qué es?"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setError(null);
        }}
        options={[
          ...(hasBranchQr ? [] : [{ value: "branch" as const, label: "Toda la sucursal" }]),
          { value: "table" as const, label: "Mesas" },
          { value: "campaign" as const, label: "Campaña" },
        ]}
      />
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {kind === "table" ? (
          <div className="grid max-w-sm grid-cols-2 gap-3">
            <Field id="qr-desde" label="Desde la mesa">
              <Input
                id="qr-desde"
                inputMode="numeric"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field id="qr-hasta" label="Hasta la mesa">
              <Input
                id="qr-hasta"
                inputMode="numeric"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
        ) : kind === "campaign" ? (
          <Field id="qr-nombre" label="Nombre" hint='P. ej. "Volante", "Instagram", "Feria".'>
            <Input
              id="qr-nombre"
              value={label}
              maxLength={40}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
        ) : (
          <p className="type-small text-muted-foreground">
            Un QR para la entrada, la caja o redes: abre el menú de la sucursal.
          </p>
        )}
        {error ? (
          <p role="alert" className="type-small font-semibold text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={pending} className="justify-self-start">
          <QrCodeIcon aria-hidden />
          {kind === "table" ? "Crear QR de mesas" : "Crear QR"}
        </Button>
      </form>
    </EditorSection>
  );
}
