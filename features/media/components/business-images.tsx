"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { runAction } from "@/lib/action-client";
import { withLoading } from "@/lib/loading/store";
import { setBusinessImage } from "../actions";
import { ImageUploader } from "./image-uploader";

type Field = "logo_url" | "cover_url";

/** Logo y portada del negocio: se guardan al subirlos (no esperan al botón Guardar). */
export function BusinessImages({
  businessId,
  logoUrl,
  coverUrl,
}: {
  businessId: string;
  logoUrl: string | null;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const [images, setImages] = useState({ logo_url: logoUrl, cover_url: coverUrl });

  const persist = async (field: Field, url: string | null) => {
    const res = await runAction(() => setBusinessImage({ businessId, field, url }));
    if (res.ok) {
      setImages((prev) => ({ ...prev, [field]: url }));
      router.refresh();
    }
    return res;
  };

  const remove = async (field: Field) => {
    const res = await withLoading("Quitando…", () => persist(field, null));
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  return (
    <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
      <div className="grid gap-1">
        <h2 className="type-h3">Logo y portada</h2>
        <p className="type-small text-muted-foreground">
          Se ven arriba de tu menú. Las fotos se achican solas para que carguen rápido.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
        <div className="grid content-start gap-2">
          <h3 className="type-body font-semibold">Logo</h3>
          <ImageUploader
            businessId={businessId}
            kind="logo"
            value={images.logo_url}
            onUploaded={(image) => persist("logo_url", image.url)}
            onRemove={() => void remove("logo_url")}
          />
        </div>
        <div className="grid content-start gap-2">
          <h3 className="type-body font-semibold">Portada</h3>
          <ImageUploader
            businessId={businessId}
            kind="cover"
            value={images.cover_url}
            onUploaded={(image) => persist("cover_url", image.url)}
            onRemove={() => void remove("cover_url")}
          />
        </div>
      </div>
    </section>
  );
}
