"use client";

import { useState } from "react";
import { ImageUploader } from "@/features/media/components/image-uploader";
import { VideoUploader } from "@/features/media/components/video-uploader";
import { parseGradient } from "@/features/public-menu/theme";
import type { AppearanceAllowance, AppearanceDoc } from "../appearance";
import { Choice, ColorField, EditorSection, PlanLock } from "./controls";

export function BackgroundSection({
  businessId,
  doc,
  update,
  allow,
  licenseHref,
}: {
  businessId: string;
  doc: AppearanceDoc;
  update: (patch: Partial<AppearanceDoc>) => void;
  allow: AppearanceAllowance;
  licenseHref: string;
}) {
  const gradient = parseGradient(doc.bg_value) ?? { from: doc.color_primary, to: doc.color_accent };
  const image = doc.bg_type === "image" ? doc.bg_value : null;
  // Pestaña elegida: imagen y video cambian lo guardado recién al subir el archivo.
  const [tab, setTab] = useState(doc.bg_type);

  return (
    <EditorSection
      title="Fondo"
      description="En el celular se ve en la portada cuando no tienes foto de portada (el video siempre va ahí). En computadoras y tablets, también a los lados del menú."
    >
      <Choice
        label="Tipo de fondo"
        value={tab}
        onChange={(next) => {
          setTab(next);
          if (next === "gradient")
            update({ bg_type: next, bg_value: `${gradient.from},${gradient.to}` });
          else if (next === "color") update({ bg_type: next, bg_value: null });
        }}
        options={[
          { value: "color", label: "Color" },
          { value: "gradient", label: "Degradado" },
          { value: "image", label: "Imagen", locked: !allow.imageBg },
          { value: "video", label: "Video", locked: !allow.videoBg },
        ]}
      />
      {!allow.imageBg || !allow.videoBg ? (
        <PlanLock licenseHref={licenseHref}>El fondo con imagen o video es del plan Pro.</PlanLock>
      ) : null}

      {tab === "color" ? (
        <p className="type-small text-muted-foreground">Se usa el color de fondo de tu paleta.</p>
      ) : null}

      {tab === "gradient" ? (
        <div className="grid gap-3 @md:grid-cols-2">
          <ColorField
            label="Color de arriba"
            value={gradient.from}
            onChange={(from) => update({ bg_value: `${from},${gradient.to}` })}
          />
          <ColorField
            label="Color de abajo"
            value={gradient.to}
            onChange={(to) => update({ bg_value: `${gradient.from},${to}` })}
          />
        </div>
      ) : null}

      {tab === "image" && allow.imageBg ? (
        <ImageUploader
          businessId={businessId}
          kind="background"
          value={image}
          label="Fondo"
          onUploaded={async (img) => {
            update({ bg_type: "image", bg_value: img.url });
            return { ok: true };
          }}
          onRemove={() => {
            setTab("color");
            update({ bg_type: "color", bg_value: null });
          }}
        />
      ) : null}

      {tab === "video" && allow.videoBg ? (
        <div className="grid gap-3">
          {doc.bg_poster_url ? (
            // Poster ya comprimido desde Storage.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.bg_poster_url}
              alt="Primer cuadro del video"
              className="aspect-video w-full max-w-sm rounded-lg border border-border object-cover"
            />
          ) : null}
          <VideoUploader
            businessId={businessId}
            value={doc.bg_video_url}
            onUploaded={({ videoUrl, posterUrl }) =>
              update({ bg_type: "video", bg_video_url: videoUrl, bg_poster_url: posterUrl })
            }
            onRemove={() => {
              setTab("color");
              update({ bg_type: "color", bg_video_url: null, bg_poster_url: null });
            }}
          />
          <p className="type-small text-muted-foreground">
            Sin sonido. Si el celular ahorra datos o pide menos movimiento, se ve el primer cuadro.
          </p>
        </div>
      ) : null}

      {(doc.bg_type === "image" && image) || (doc.bg_type === "video" && doc.bg_video_url) ? (
        <label className="grid gap-1">
          <span className="type-small font-semibold">
            Capa oscura: {Math.round(doc.bg_overlay * 100)} %
          </span>
          <input
            type="range"
            min={0}
            max={0.8}
            step={0.05}
            value={doc.bg_overlay}
            onChange={(e) => update({ bg_overlay: Number(e.target.value) })}
            className="accent-primary"
          />
          <span className="type-caption text-muted-foreground">
            Oscurece la foto o el video para que el nombre y el logo resalten.
          </span>
        </label>
      ) : null}
    </EditorSection>
  );
}
