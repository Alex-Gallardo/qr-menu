"use client";

import { PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/forms/field";
import { PrefixedInput } from "@/components/forms/prefixed-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploader } from "@/features/media/components/image-uploader";
import { runAction } from "@/lib/action-client";
import { saveProductsStep } from "../actions";
import { MAX_FIRST_PRODUCTS, SAMPLE_PRODUCTS } from "../onboarding";
import { productsStepSchema } from "../schemas";

type Row = {
  key: number;
  name: string;
  price: string;
  imageUrl: string | null;
  imageBlurhash: string | null;
};

const empty = (key: number): Row => ({
  key,
  name: "",
  price: "",
  imageUrl: null,
  imageBlurhash: null,
});

/**
 * Paso 3: los primeros 5 productos (nombre, precio y foto) o ejemplos para
 * editar después. Quedan en el menú principal, en "Lo más pedido".
 */
export function ProductsStep({ businessId, existing }: { businessId: string; existing: number }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => [0, 1, 2].map(empty));
  const [nextKey, setNextKey] = useState(3);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function addRow() {
    if (rows.length >= MAX_FIRST_PRODUCTS) return;
    setRows((rs) => [...rs, empty(nextKey)]);
    setNextKey((k) => k + 1);
  }

  function fillSamples() {
    setRows(
      SAMPLE_PRODUCTS.map((p, i) => ({ ...empty(nextKey + i), name: p.name, price: p.price })),
    );
    setNextKey((k) => k + SAMPLE_PRODUCTS.length);
    setErrors({});
  }

  function submit() {
    // Las filas vacías se ignoran; las que tienen algo se validan.
    const filled = rows.filter((r) => r.name.trim() || r.price.trim() || r.imageUrl);
    const parsed = productsStepSchema.safeParse({
      businessId,
      products: filled.map((r) => ({
        name: r.name,
        price: r.price,
        imageUrl: r.imageUrl,
        imageBlurhash: r.imageBlurhash,
      })),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const [, index, field] = issue.path;
        const row = typeof index === "number" ? filled[index] : undefined;
        if (row && typeof field === "string") next[`${row.key}.${field}`] ??= issue.message;
      }
      setErrors(next);
      setError(Object.keys(next).length ? null : (parsed.error.issues[0]?.message ?? null));
      return;
    }
    setErrors({});
    startSave(async () => {
      setError(null);
      const res = await runAction(() => saveProductsStep(parsed.data));
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.push("/onboarding?paso=4");
    });
  }

  return (
    <div className="grid gap-6">
      {existing > 0 ? (
        <p className="type-small rounded-md bg-muted px-3 py-2 text-muted-foreground">
          Ya tienes {existing} {existing === 1 ? "producto" : "productos"}. Puedes agregar más aquí
          o{" "}
          <button
            type="button"
            className="font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => router.push("/onboarding?paso=4")}
          >
            seguir a publicar
          </button>
          .
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-small text-muted-foreground">
          Empieza con tus 5 más pedidos. Las opciones (tamaño, extras) y el resto los agregas
          después en Productos.
        </p>
        <Button type="button" variant="outline" onClick={fillSamples}>
          <SparklesIcon aria-hidden />
          Usar ejemplos
        </Button>
      </div>

      <ol className="grid gap-4">
        {rows.map((r, i) => (
          <li
            key={r.key}
            className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-1 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-start"
          >
            <ImageUploader
              businessId={businessId}
              kind="product"
              value={r.imageUrl}
              label={`Foto del producto ${i + 1}`}
              onUploaded={async (image) => {
                setRow(r.key, { imageUrl: image.url, imageBlurhash: image.blurhash });
                return { ok: true };
              }}
              onRemove={() => setRow(r.key, { imageUrl: null, imageBlurhash: null })}
            />
            <div className="grid content-start gap-4">
              <Field
                id={`name-${r.key}`}
                label={`Producto ${i + 1}`}
                error={errors[`${r.key}.name`]}
              >
                <Input
                  id={`name-${r.key}`}
                  value={r.name}
                  placeholder={SAMPLE_PRODUCTS[i % SAMPLE_PRODUCTS.length]!.name}
                  aria-invalid={!!errors[`${r.key}.name`]}
                  onChange={(e) => setRow(r.key, { name: e.target.value })}
                />
              </Field>
              <div className="flex items-end gap-3">
                <Field id={`price-${r.key}`} label="Precio" error={errors[`${r.key}.price`]}>
                  <PrefixedInput
                    id={`price-${r.key}`}
                    prefix="Q"
                    inputMode="decimal"
                    value={r.price}
                    placeholder="45"
                    invalid={!!errors[`${r.key}.price`]}
                    onChange={(e) => setRow(r.key, { price: e.target.value })}
                  />
                </Field>
                {rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar el producto ${i + 1}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {rows.length < MAX_FIRST_PRODUCTS ? (
        <Button type="button" variant="outline" className="justify-self-start" onClick={addRow}>
          <PlusIcon aria-hidden />
          Otro producto
        </Button>
      ) : null}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => router.push("/onboarding?paso=2")}>
          Atrás
        </Button>
        <Button type="button" size="lg" loading={saving} onClick={submit}>
          Siguiente: publicar
        </Button>
      </div>
    </div>
  );
}
