"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/features/media/components/image-uploader";
import type { ActionResult } from "@/lib/action-result";
import { formatQ, parseQ } from "@/lib/money";
import { saveProduct } from "../actions";
import { PRODUCT_TAGS } from "../catalog";
import { OptionGroupsEditor } from "./option-groups-editor";
import { productFormSchema, type ProductFormInput, type ProductFormOutput } from "../schemas";

type FormControl = Control<ProductFormInput, unknown, ProductFormOutput>;

type Props = {
  mode: "create" | "edit";
  initial: ProductFormInput;
  categories: { id: string; name: string }[];
  /** Sucursales visibles, en el mismo orden que initial.branches. */
  branches: { id: string; name: string }[];
  canToggleEverywhere: boolean;
  listHref: string;
};

const textareaClass =
  "w-full rounded-md border border-input bg-card px-4 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive";
const selectClass =
  "h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export function ProductForm({
  mode,
  initial,
  categories,
  branches,
  canToggleEverywhere,
  listHref,
}: Props) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, startSave] = useTransition();
  const form = useForm<ProductFormInput, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initial,
  });
  const { errors, isDirty } = form.formState;
  const control = form.control;
  const [imageUrl, price] = useWatch({ control, name: ["image_url", "price"] });

  // La Server Action vuelve a validar con el mismo esquema: se envían los valores crudos.
  const onSubmit = form.handleSubmit(() =>
    startSave(async () => {
      const values = form.getValues();
      setResult(null);
      const res = await saveProduct(values);
      if (res.ok && mode === "create") {
        router.push(listHref);
        router.refresh();
        return;
      }
      setResult(res);
      if (res.ok) {
        form.reset(values);
        router.refresh();
      }
    }),
  );

  const setImage = (url: string | null, blurhash: string | null) => {
    form.setValue("image_url", url, { shouldDirty: true });
    form.setValue("image_blurhash", blurhash, { shouldDirty: true });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <Card title="Foto">
        <div className="max-w-sm">
          <ImageUploader
            businessId={initial.businessId}
            kind="product"
            value={imageUrl}
            onUploaded={async (image) => {
              setImage(image.url, image.blurhash);
              return { ok: true, message: "Foto lista. Guarda el producto para publicarla." };
            }}
            onRemove={() => setImage(null, null)}
          />
        </div>
      </Card>

      <Card title="Datos">
        <Field id="name" label="Nombre" error={errors.name?.message}>
          <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
        </Field>
        <Field
          id="description"
          label="Descripción"
          error={errors.description?.message}
          hint="Qué lleva y cómo se sirve. Se muestran 2 líneas en el menú."
        >
          <textarea
            id="description"
            rows={3}
            aria-invalid={!!errors.description}
            className={textareaClass}
            {...form.register("description")}
          />
        </Field>
        <Field
          id="category_id"
          label="Categoría"
          hint={
            categories.length === 0 ? "Crea categorías desde la lista de productos." : undefined
          }
        >
          <select id="category_id" className={selectClass} {...form.register("category_id")}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Controller
          control={control}
          name="tags"
          render={({ field }) => (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold">Etiquetas</legend>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_TAGS.map((tag) => {
                  const on = field.value.includes(tag.value);
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        field.onChange(
                          on
                            ? field.value.filter((t) => t !== tag.value)
                            : [...field.value, tag.value],
                        )
                      }
                      className="type-small h-10 rounded-full border border-border bg-card px-4 font-semibold transition-colors aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        />
      </Card>

      <Card title="Precio">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="price" label="Precio (Q)" error={errors.price?.message}>
            <Input
              id="price"
              inputMode="decimal"
              placeholder="45.00"
              aria-invalid={!!errors.price}
              {...form.register("price")}
            />
          </Field>
          <Field
            id="compare_at"
            label="Precio tachado (Q)"
            error={errors.compare_at?.message}
            hint="Opcional: el precio de antes, para mostrar una oferta."
          >
            <Input
              id="compare_at"
              inputMode="decimal"
              aria-invalid={!!errors.compare_at}
              {...form.register("compare_at")}
            />
          </Field>
        </div>
        <Field
          id="prep_minutes"
          label="Tiempo de preparación (minutos)"
          error={errors.prep_minutes?.message}
          hint="Opcional. Ayuda a calcular la hora de entrega."
        >
          <Input
            id="prep_minutes"
            inputMode="numeric"
            className="sm:max-w-40"
            aria-invalid={!!errors.prep_minutes}
            {...form.register("prep_minutes")}
          />
        </Field>
      </Card>

      <Card title="Opciones">
        <OptionGroupsEditor control={control} register={form.register} errors={errors.groups} />
      </Card>

      <Card title="Disponibilidad por sucursal">
        <Controller
          control={control}
          name="is_available"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="is_available" className="grid gap-0.5">
                <span className="type-body font-medium">Disponible en todas las sucursales</span>
                <span className="type-small text-muted-foreground">
                  {canToggleEverywhere
                    ? "Apágalo para agotarlo en todas a la vez."
                    : "Solo el dueño o quien ve todas las sucursales lo cambia."}
                </span>
              </label>
              <Switch
                id="is_available"
                checked={field.value}
                disabled={!canToggleEverywhere}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
        {branches.length > 0 ? (
          <ul className="grid divide-y divide-border rounded-lg border border-border">
            {branches.map((branch, index) => (
              <BranchRow
                key={branch.id}
                control={control}
                index={index}
                name={branch.name}
                basePrice={price}
                error={errors.branches?.[index]?.price?.message}
                register={form.register}
              />
            ))}
          </ul>
        ) : null}
        <p className="type-small text-muted-foreground">
          Deja el precio vacío para usar el mismo en todas. Agotar en una sucursal no afecta a las
          demás.
        </p>
      </Card>

      <div className="sticky bottom-16 z-10 -mx-4 grid gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-xl lg:border lg:px-5 [@media(max-height:500px)]:static">
        {result ? (
          <FormMessage tone={result.ok ? "success" : "error"}>{result.message}</FormMessage>
        ) : null}
        <Button
          type="submit"
          loading={saving}
          disabled={mode === "edit" && !isDirty}
          className="w-full shadow-2 sm:w-auto sm:justify-self-end"
        >
          {mode === "create" ? "Agregar producto" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function BranchRow({
  control,
  index,
  name,
  basePrice,
  error,
  register,
}: {
  control: FormControl;
  index: number;
  name: string;
  basePrice: string;
  error?: string;
  register: ReturnType<typeof useForm<ProductFormInput, unknown, ProductFormOutput>>["register"];
}) {
  const base = parseQ(basePrice);
  const everywhere = useWatch({ control, name: "is_available" });
  return (
    <li className="grid gap-3 p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-center sm:gap-4 sm:p-4">
      <span className="type-body font-semibold">{name}</span>
      <div className="grid gap-1">
        <Input
          inputMode="decimal"
          aria-label={`Precio en ${name} (Q)`}
          aria-invalid={!!error}
          placeholder={base !== null ? formatQ(base) : "Mismo precio"}
          {...register(`branches.${index}.price`)}
        />
        {error ? (
          <span role="alert" className="type-caption text-destructive">
            {error}
          </span>
        ) : null}
      </div>
      <Controller
        control={control}
        name={`branches.${index}.is_available`}
        render={({ field }) => (
          <label className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="type-small text-muted-foreground">
              {!everywhere ? "Agotado en todas" : field.value ? "Disponible aquí" : "Agotado aquí"}
            </span>
            <Switch
              checked={everywhere && field.value}
              disabled={!everywhere}
              onCheckedChange={field.onChange}
              aria-label={`Disponible en ${name}`}
            />
          </label>
        )}
      />
    </li>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
      <h2 className="type-h3">{title}</h2>
      {children}
    </section>
  );
}
