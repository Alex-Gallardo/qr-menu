"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CopyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
  type UseFormRegister,
} from "react-hook-form";
import { cn } from "cn";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/features/businesses/slug";
import type { ActionResult } from "@/lib/action-result";
import { createBranch, updateBranch } from "../actions";
import { WEEKDAYS } from "../hours";
import { branchFormSchema, type BranchFormInput, type BranchFormOutput } from "../schemas";

type FormControl = Control<BranchFormInput, unknown, BranchFormOutput>;

type Props = {
  mode: "create" | "edit";
  initial: BranchFormInput;
  /** {host}/{negocio}/ para mostrar el link público. */
  publicPrefix: string;
  canPreorder: boolean;
  /** Ruta del listado de sucursales (para volver después de crear). */
  listHref: string;
};

const PREORDER_OPTIONS = [
  {
    value: "off",
    title: "No permitir",
    text: "El menú se ve, pero pedir se desactiva hasta que abras.",
  },
  {
    value: "next_open",
    title: "Para cuando abra",
    text: "El cliente elige una hora desde tu apertura.",
  },
  {
    value: "always",
    title: "Siempre",
    text: "Reciben pedidos a cualquier hora; tú decides cuándo atender.",
  },
] as const;

export function BranchForm({ mode, initial, publicPrefix, canPreorder, listHref }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, startSave] = useTransition();
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const form = useForm<BranchFormInput, unknown, BranchFormOutput>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: initial,
  });
  const { errors, isDirty } = form.formState;
  const control = form.control;
  const [slug, acceptsDelivery, preorderMode] = useWatch({
    control,
    name: ["slug", "accepts_delivery", "preorder_mode"],
  });

  // La Server Action vuelve a validar con el mismo esquema: se envían los valores crudos.
  const onSubmit = form.handleSubmit(() =>
    startSave(async () => {
      const values = form.getValues();
      setResult(null);
      if (mode === "create") {
        const res = await createBranch(values);
        if (res.ok) {
          router.push(listHref);
          router.refresh();
          return;
        }
        setResult(res);
      } else {
        const res = await updateBranch(values);
        setResult(res);
        if (res.ok) form.reset(values);
      }
    }),
  );

  const copyMondayToAll = () => {
    const monday = form.getValues("hours.1");
    for (let d = 0; d < 7; d++) {
      if (d === 1) continue;
      form.setValue(`hours.${d}`, { ...monday, weekday: d }, { shouldDirty: true });
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <Card title="Datos y WhatsApp">
        <Field
          id="name"
          label="Nombre de la sucursal"
          error={errors.name?.message}
          hint="Por ejemplo: Zona 10, Antigua, Centro."
        >
          <Input
            id="name"
            aria-invalid={!!errors.name}
            {...form.register("name", {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                if (!slugTouched)
                  form.setValue("slug", slugify(e.target.value), { shouldDirty: true });
              },
            })}
          />
        </Field>
        <Field
          id="slug"
          label="Link de la sucursal"
          error={errors.slug?.message}
          hint={`${publicPrefix}${slug || "…"}`}
        >
          <Input
            id="slug"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!errors.slug}
            {...form.register("slug", { onChange: () => setSlugTouched(true) })}
          />
        </Field>
        <Field
          id="whatsapp"
          label="WhatsApp que recibe los pedidos"
          error={errors.whatsapp?.message}
          hint="Aquí te llegan los pedidos. Recomendamos el WhatsApp del local, no uno personal."
        >
          <PrefixedInput
            prefix="+502"
            id="whatsapp"
            inputMode="tel"
            autoComplete="tel"
            invalid={!!errors.whatsapp}
            {...form.register("whatsapp")}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="address" label="Dirección" error={errors.address?.message}>
            <Input
              id="address"
              placeholder="6a avenida 8-50, zona 1"
              {...form.register("address")}
            />
          </Field>
          <Field id="city" label="Ciudad" error={errors.city?.message}>
            <Input id="city" placeholder="Ciudad de Guatemala" {...form.register("city")} />
          </Field>
        </div>
        <Field
          id="address_reference"
          label="Punto de referencia"
          error={errors.address_reference?.message}
        >
          <Input
            id="address_reference"
            placeholder="Frente al parque central"
            {...form.register("address_reference")}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="phone" label="Teléfono (opcional)" error={errors.phone?.message}>
            <PrefixedInput
              prefix="+502"
              id="phone"
              inputMode="tel"
              invalid={!!errors.phone}
              {...form.register("phone")}
            />
          </Field>
          <Field
            id="google_place_id"
            label="Google Place ID (opcional)"
            error={errors.google_place_id?.message}
            hint="Para invitar a tus clientes a dejar reseña en Google."
          >
            <Input
              id="google_place_id"
              autoCapitalize="none"
              spellCheck={false}
              {...form.register("google_place_id")}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Horario"
        action={
          <Button type="button" variant="ghost" size="sm" onClick={copyMondayToAll}>
            <CopyIcon />
            Copiar lunes a todos
          </Button>
        }
      >
        {errors.hours?.message || errors.hours?.root?.message ? (
          <FormMessage tone="error">
            {errors.hours.message ?? errors.hours.root?.message}
          </FormMessage>
        ) : null}
        <ul className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <DayRow
              key={d}
              control={control}
              index={d}
              error={errors.hours?.[d]?.closes?.message}
              register={form.register}
            />
          ))}
        </ul>
        <p className="type-caption text-muted-foreground">
          Si cierras después de la medianoche, pon la hora de cierre del día siguiente (18:00 a
          02:00).
        </p>
      </Card>

      <Card title="Tipos de pedido">
        {errors.accepts_dine_in?.message ? (
          <FormMessage tone="error">{errors.accepts_dine_in.message}</FormMessage>
        ) : null}
        <SwitchRow control={control} name="accepts_dine_in" label="Comer aquí" />
        <SwitchRow control={control} name="accepts_takeout" label="Para llevar" />
        <SwitchRow control={control} name="accepts_delivery" label="A domicilio" />
        <SwitchRow
          control={control}
          name="accepts_transfer"
          label="Aceptar pago por transferencia"
          hint="Tus clientes verán tus cuentas al elegir transferencia."
        />
      </Card>

      {acceptsDelivery ? (
        <Card title="Entregas a domicilio">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="delivery_fee" label="Costo de envío" error={errors.delivery_fee?.message}>
              <PrefixedInput
                prefix="Q"
                id="delivery_fee"
                inputMode="decimal"
                invalid={!!errors.delivery_fee}
                {...form.register("delivery_fee")}
              />
            </Field>
            <Field id="min_order" label="Pedido mínimo" error={errors.min_order?.message}>
              <PrefixedInput
                prefix="Q"
                id="min_order"
                inputMode="decimal"
                invalid={!!errors.min_order}
                {...form.register("min_order")}
              />
            </Field>
            <Field
              id="delivery_radius_km"
              label="Radio de entrega"
              error={errors.delivery_radius_km?.message}
              hint="Vacío = sin límite."
            >
              <PrefixedInput
                suffix="km"
                id="delivery_radius_km"
                inputMode="decimal"
                invalid={!!errors.delivery_radius_km}
                {...form.register("delivery_radius_km")}
              />
            </Field>
          </div>
          <SwitchRow
            control={control}
            name="delivery_requires_location"
            label="Pedir la ubicación del cliente"
            hint="Si no la comparte, puede escribir su dirección y una referencia."
          />
        </Card>
      ) : null}

      <Card title="Pedidos fuera de horario">
        {!canPreorder ? (
          <p className="type-small rounded-md bg-maiz/20 px-4 py-3">
            Los pedidos fuera de horario están en el plan Pro. Con tu plan, el menú se ve pero no se
            puede pedir cuando estás cerrado.
          </p>
        ) : null}
        <Controller
          control={control}
          name="preorder_mode"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-label="Pedidos fuera de horario"
              className="grid gap-2 sm:grid-cols-3"
            >
              {PREORDER_OPTIONS.map((o) => {
                const disabled = !canPreorder && o.value !== "off" && field.value !== o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={field.value === o.value}
                    disabled={disabled}
                    onClick={() => field.onChange(o.value)}
                    className="grid gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 aria-checked:border-primary aria-checked:bg-primary/5 aria-checked:ring-2 aria-checked:ring-primary/30"
                  >
                    <span className="type-small font-semibold">{o.title}</span>
                    <span className="type-caption text-muted-foreground">{o.text}</span>
                  </button>
                );
              })}
            </div>
          )}
        />
        {preorderMode !== "off" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="preorder_min_lead_min"
              label="Anticipación mínima"
              error={errors.preorder_min_lead_min?.message}
              hint="Tiempo mínimo entre el pedido y la hora elegida."
            >
              <PrefixedInput
                suffix="min"
                id="preorder_min_lead_min"
                inputMode="numeric"
                {...form.register("preorder_min_lead_min")}
              />
            </Field>
            <Field
              id="preorder_max_days"
              label="Hasta cuántos días antes"
              error={errors.preorder_max_days?.message}
            >
              <PrefixedInput
                suffix="días"
                id="preorder_max_days"
                inputMode="numeric"
                {...form.register("preorder_max_days")}
              />
            </Field>
          </div>
        ) : null}
      </Card>

      {mode === "edit" ? (
        <Card title="Estado">
          <SwitchRow
            control={control}
            name="is_active"
            label="Sucursal activa"
            hint="Si la pausas, su menú deja de recibir pedidos hasta que la actives otra vez."
          />
        </Card>
      ) : null}

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
          {mode === "create" ? "Crear sucursal" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-h3">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SwitchRow({
  control,
  name,
  label,
  hint,
}: {
  control: FormControl;
  name: FieldPath<BranchFormInput>;
  label: string;
  hint?: string;
}) {
  const id = `sw-${name}`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={id} className="grid gap-0.5">
            <span className="type-body font-medium">{label}</span>
            {hint ? <span className="type-small text-muted-foreground">{hint}</span> : null}
          </label>
          <Switch id={id} checked={field.value === true} onCheckedChange={field.onChange} />
        </div>
      )}
    />
  );
}

function DayRow({
  control,
  index,
  error,
  register,
}: {
  control: FormControl;
  index: number;
  error?: string;
  register: UseFormRegister<BranchFormInput>;
}) {
  const open = useWatch({ control, name: `hours.${index}.open` });
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[9rem_1fr] sm:items-center">
      <Controller
        control={control}
        name={`hours.${index}.open`}
        render={({ field }) => (
          <label className="flex items-center gap-3">
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label={`Abierto el ${WEEKDAYS[index]}`}
            />
            <span className="type-body font-medium">{WEEKDAYS[index]}</span>
          </label>
        )}
      />
      <div className={cn("flex flex-wrap items-center gap-2", !open && "opacity-50")}>
        {open ? (
          <>
            <Input
              type="time"
              step={900}
              aria-label={`Abre el ${WEEKDAYS[index]}`}
              className="w-32"
              {...register(`hours.${index}.opens`)}
            />
            <span className="type-small text-muted-foreground">a</span>
            <Input
              type="time"
              step={900}
              aria-label={`Cierra el ${WEEKDAYS[index]}`}
              aria-invalid={!!error}
              className="w-32"
              {...register(`hours.${index}.closes`)}
            />
          </>
        ) : (
          <span className="type-small text-muted-foreground">Cerrado</span>
        )}
        {error ? (
          <p role="alert" className="type-small w-full text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Input con prefijo (+502, Q) o sufijo (km, min). */
function PrefixedInput({
  prefix,
  suffix,
  invalid,
  className,
  ...props
}: React.ComponentProps<"input"> & { prefix?: string; suffix?: string; invalid?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-12 items-stretch overflow-hidden rounded-md border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        invalid && "border-destructive",
      )}
    >
      {prefix ? (
        <span className="type-small flex items-center bg-muted px-3 text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <input
        aria-invalid={invalid || undefined}
        className={cn("min-w-0 flex-1 bg-transparent px-3 text-base outline-none", className)}
        {...props}
      />
      {suffix ? (
        <span className="type-small flex items-center bg-muted px-3 text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
