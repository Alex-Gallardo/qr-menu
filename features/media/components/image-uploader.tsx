"use client";

import { ImageIcon, ImageUpIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage, uploadWithProgress } from "@/lib/images/compress";
import { ACCEPTED_TYPES, IMAGE_KINDS, MAX_INPUT_BYTES, type ImageKind } from "@/lib/images/presets";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { setLoadingProgress, withLoading } from "@/lib/loading/store";
import type { ActionResult } from "@/lib/action-result";
import { createImageUpload, registerImage } from "../actions";

export type UploadedImage = { id: string; url: string; blurhash: string | null };

type Props = {
  businessId: string;
  kind: ImageKind;
  /** URL actual (o null si no hay imagen). */
  value: string | null;
  /** Guarda la imagen ya subida (p. ej. como logo); corre dentro del mismo modal. */
  onUploaded: (image: UploadedImage) => Promise<ActionResult>;
  onRemove?: () => void;
  label?: string;
};

/**
 * Elegir → recortar (con la proporción del tipo) → comprimir en el navegador
 * (WebP ≤ 300 KB) → subir directo a Storage con barra de avance → registrar.
 */
export function ImageUploader({ businessId, kind, value, onUploaded, onRemove, label }: Props) {
  const preset = IMAGE_KINDS[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);

  const closeCrop = () => {
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(null);
  };

  const pick = (selected: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!selected) return;
    if (selected.type && !selected.type.startsWith("image/")) {
      toast.error("Ese archivo no es una foto. Elige una imagen JPG, PNG o WebP.");
      return;
    }
    if (selected.size > MAX_INPUT_BYTES) {
      toast.error("La foto pesa más de 25 MB. Elige otra un poco más liviana.");
      return;
    }
    setPicked({ file: selected, url: URL.createObjectURL(selected) });
  };

  const upload = async (crop: Area) => {
    if (!picked) return;
    const source = picked.file;
    closeCrop();
    try {
      const saved = await withLoading("Subiendo tu foto…", async (signal) => {
        setLoadingProgress(0.05);
        const compressed = await compressImage(source, crop, kind);
        setLoadingProgress(0.15);

        const start = await createImageUpload({
          businessId,
          kind,
          bytes: compressed.blob.size,
          ext: compressed.ext,
        });
        if (!start.ok) throw new UploadError(start.message);

        await uploadWithProgress(
          start.data.signedUrl,
          compressed.blob,
          (fraction) => setLoadingProgress(0.15 + fraction * 0.8),
          signal,
        );

        const registered = await registerImage({
          businessId,
          kind,
          path: start.data.path,
          width: compressed.width,
          height: compressed.height,
          blurhash: compressed.blurhash,
        });
        if (!registered.ok) throw new UploadError(registered.message);
        setLoadingProgress(1);
        const result = await onUploaded(registered.data);
        if (!result.ok) throw new UploadError(result.message);
        return result;
      });
      if (saved.message) toast.success(saved.message);
    } catch (error) {
      if (error instanceof LoadingCancelledError || isAbort(error)) {
        toast("Cancelamos la subida.");
      } else if (error instanceof UploadError) {
        toast.error(error.message);
      } else {
        toast.error(
          isDecodeError(error)
            ? "No pudimos abrir esa foto. Prueba con una JPG o PNG."
            : "No pudimos subir la foto. Revisa tu internet y probemos otra vez.",
        );
      }
    }
  };

  const title = label ?? capitalize(preset.label);

  return (
    <div className="grid gap-3">
      <div
        className="relative overflow-hidden rounded-lg border border-border bg-muted"
        style={{ aspectRatio: preset.aspect, maxWidth: kind === "logo" ? "10rem" : undefined }}
      >
        {value ? (
          // Ya viene comprimida desde Storage: sin optimizador.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={title} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ImageIcon className="size-8" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <ImageUpIcon aria-hidden />
          {value ? "Cambiar" : "Subir"} {preset.label}
        </Button>
        {value && onRemove ? (
          <Button type="button" variant="ghost" onClick={onRemove}>
            <Trash2Icon aria-hidden />
            Quitar
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={["image/*", ...ACCEPTED_TYPES].join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label={`Elegir ${preset.label}`}
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {picked ? (
        <CropDialog
          src={picked.url}
          aspect={preset.aspect}
          title={`Ajusta tu ${preset.label}`}
          round={kind === "logo"}
          onCancel={closeCrop}
          onConfirm={(crop) => void upload(crop)}
        />
      ) : null}
    </div>
  );
}

function CropDialog({
  src,
  aspect,
  title,
  round,
  onCancel,
  onConfirm,
}: {
  src: string;
  aspect: number;
  title: string;
  round: boolean;
  onCancel: () => void;
  onConfirm: (crop: Area) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground shadow-3 backdrop:bg-frijol/50"
    >
      <div className="grid gap-4 p-5">
        <h2 id="crop-title" className="type-h3">
          {title}
        </h2>
        <div className="relative h-72 overflow-hidden rounded-lg bg-frijol sm:h-80">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={round ? "round" : "rect"}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <label className="grid gap-2">
          <span className="type-small text-muted-foreground">Acercar</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-12 w-full accent-primary"
          />
        </label>
        <p className="type-small -mt-2 text-muted-foreground">Arrastra la foto para encuadrarla.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={!area} onClick={() => area && onConfirm(area)}>
            Usar esta foto
          </Button>
        </div>
      </div>
    </dialog>
  );
}

class UploadError extends Error {}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/** createImageBitmap falla con formatos que el navegador no sabe abrir (p. ej. HEIC en Chrome). */
const isDecodeError = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === "InvalidStateError" || error.name === "EncodingError");

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
