"use client";

import { FilmIcon, Trash2Icon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/action-client";
import { compressImage, uploadWithProgress } from "@/lib/images/compress";
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from "@/lib/images/presets";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { setLoadingProgress, withLoading } from "@/lib/loading/store";
import { createImageUpload, createVideoUpload, registerImage, registerVideo } from "../actions";

class UploadError extends Error {}

/** Duración, tamaño y un cuadro (para el poster) del video elegido, en el navegador. */
function inspectVideo(file: File) {
  return new Promise<{ duration: number; width: number; height: number; poster: Blob }>(
    (resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      const fail = () => {
        URL.revokeObjectURL(url);
        reject(new UploadError("No pudimos abrir ese video. Prueba con un MP4 (H.264)."));
      };
      video.onerror = fail;
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(0.5, video.duration / 2);
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")!.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return fail();
            resolve({
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
              poster: blob,
            });
          },
          "image/jpeg",
          0.9,
        );
      };
      video.src = url;
    },
  );
}

/**
 * Video de fondo: MP4 de máximo 6 MB y 10 s. Sube también un poster (el
 * primer medio segundo) que se muestra mientras carga y cuando el celular
 * ahorra datos o reduce el movimiento.
 */
export function VideoUploader({
  businessId,
  value,
  onUploaded,
  onRemove,
}: {
  businessId: string;
  value: string | null;
  onUploaded: (video: { videoUrl: string; posterUrl: string }) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (file.type && file.type !== "video/mp4") {
      toast.error("Usa un video MP4.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("El video pesa más de 6 MB. Recórtalo a 10 segundos o bájale la calidad.");
      return;
    }
    try {
      const saved = await withLoading("Subiendo tu video…", async (signal) => {
        setLoadingProgress(0.02);
        const info = await inspectVideo(file);
        if (info.duration > MAX_VIDEO_SECONDS + 0.5)
          throw new UploadError(`El video dura más de ${MAX_VIDEO_SECONDS} segundos. Recórtalo.`);

        // Poster: el mismo pipeline de las fotos (WebP ≤ 300 KB).
        const poster = await compressImage(
          info.poster,
          { x: 0, y: 0, width: info.width, height: info.height },
          "background",
        );
        const posterStart = await runAction(() =>
          createImageUpload({
            businessId,
            kind: "background",
            bytes: poster.blob.size,
            ext: poster.ext,
          }),
        );
        if (!posterStart.ok) throw new UploadError(posterStart.message);
        await uploadWithProgress(posterStart.data.signedUrl, poster.blob, () => {}, signal);
        const posterSaved = await runAction(() =>
          registerImage({
            businessId,
            kind: "background",
            path: posterStart.data.path,
            width: poster.width,
            height: poster.height,
            blurhash: poster.blurhash,
          }),
        );
        if (!posterSaved.ok) throw new UploadError(posterSaved.message);
        setLoadingProgress(0.1);

        const start = await runAction(() => createVideoUpload({ businessId, bytes: file.size }));
        if (!start.ok) throw new UploadError(start.message);
        await uploadWithProgress(
          start.data.signedUrl,
          file,
          (fraction) => setLoadingProgress(0.1 + fraction * 0.85),
          signal,
        );
        const video = await runAction(() =>
          registerVideo({
            businessId,
            path: start.data.path,
            width: info.width,
            height: info.height,
          }),
        );
        if (!video.ok) throw new UploadError(video.message);
        setLoadingProgress(1);
        return { videoUrl: video.data.url, posterUrl: posterSaved.data.url };
      });
      onUploaded(saved);
    } catch (error) {
      if (error instanceof LoadingCancelledError || (error as Error).name === "AbortError") {
        toast("Cancelamos la subida.");
      } else {
        toast.error(
          error instanceof UploadError
            ? error.message
            : "No pudimos subir el video. Revisa tu internet y probemos otra vez.",
        );
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
        <FilmIcon aria-hidden />
        {value ? "Cambiar video" : "Subir video"}
      </Button>
      {value && onRemove ? (
        <Button type="button" variant="ghost" onClick={onRemove}>
          <Trash2Icon aria-hidden />
          Quitar
        </Button>
      ) : null}
      <span className="type-small text-muted-foreground">MP4, máximo 6 MB y 10 segundos.</span>
    </div>
  );
}
