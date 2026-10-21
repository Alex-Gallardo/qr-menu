"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { deltaToInput, describeGroup, GROUP_PRESETS, MAX_GROUPS, MAX_OPTIONS } from "../options";
import type { ProductFormInput, ProductFormOutput } from "../schemas";

type FormControl = Control<ProductFormInput, unknown, ProductFormOutput>;
type Register = UseFormRegister<ProductFormInput>;
type GroupErrors = NonNullable<FieldErrors<ProductFormInput>["groups"]>;

const newOption = () => ({ name: "", price: "", is_available: true });

function fromPreset(preset: (typeof GROUP_PRESETS)[keyof typeof GROUP_PRESETS]) {
  return {
    name: preset.name,
    required: preset.min_select > 0,
    min: String(Math.max(1, preset.min_select)),
    max: String(preset.max_select),
    options: preset.options.map((o) => ({
      name: o.name,
      price: deltaToInput(o.price_delta_cents),
      is_available: true,
    })),
  };
}

/**
 * Grupos de opciones del producto: "Tamaño" (obligatorio, elige 1), "Extras"
 * (opcional, hasta 3)… Se guardan junto con el producto.
 */
export function OptionGroupsEditor({
  control,
  register,
  errors,
}: {
  control: FormControl;
  register: Register;
  errors?: GroupErrors;
}) {
  const groups = useFieldArray({ control, name: "groups", keyName: "key" });
  const names = (useWatch({ control, name: "groups" }) ?? []).map((g) =>
    g.name.trim().toLowerCase(),
  );
  const canAdd = groups.fields.length < MAX_GROUPS;

  return (
    <div className="grid gap-4">
      {groups.fields.length === 0 ? (
        <p className="type-small text-muted-foreground">
          Sin opciones, el cliente agrega el producto con un toque. Agrega un grupo si hay que
          elegir tamaño, término o extras.
        </p>
      ) : null}

      {groups.fields.map((field, index) => (
        <GroupCard
          key={field.key}
          control={control}
          register={register}
          index={index}
          count={groups.fields.length}
          errors={errors?.[index]}
          onMove={(direction) => groups.move(index, index + direction)}
          onRemove={() => groups.remove(index)}
        />
      ))}

      {canAdd ? (
        <div className="flex flex-wrap gap-2">
          {!names.includes("tamaño") ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => groups.append(fromPreset(GROUP_PRESETS.size))}
            >
              <PlusIcon />
              Tamaño (obligatorio)
            </Button>
          ) : null}
          {!names.includes("extras") ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => groups.append(fromPreset(GROUP_PRESETS.extras))}
            >
              <PlusIcon />
              Extras (hasta 3)
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              groups.append({
                name: "",
                required: false,
                min: "1",
                max: "1",
                options: [newOption()],
              })
            }
          >
            <PlusIcon />
            Otro grupo
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function GroupCard({
  control,
  register,
  index,
  count,
  errors,
  onMove,
  onRemove,
}: {
  control: FormControl;
  register: Register;
  index: number;
  count: number;
  errors?: GroupErrors[number];
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const options = useFieldArray({ control, name: `groups.${index}.options`, keyName: "key" });
  const [name, required, min, max] = useWatch({
    control,
    name: [
      `groups.${index}.name`,
      `groups.${index}.required`,
      `groups.${index}.min`,
      `groups.${index}.max`,
    ],
  });
  const rule = { min_select: required ? Number(min) : 0, max_select: Number(max) };
  const summary =
    Number.isInteger(rule.min_select) && rule.max_select >= 1
      ? describeGroup(rule)
      : "Revisa cuántas puede elegir";
  const label = (name ?? "").trim() || `Grupo ${index + 1}`;
  const optionsError = errors?.options?.message ?? errors?.options?.root?.message;

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-start gap-2">
        <div className="grid flex-1 gap-1">
          <Input
            aria-label={`Nombre del grupo ${index + 1}`}
            placeholder="Ej.: Tamaño, Término, Extras"
            aria-invalid={!!errors?.name}
            className="font-semibold"
            {...register(`groups.${index}.name`)}
          />
          {errors?.name ? (
            <span role="alert" className="type-caption text-destructive">
              {errors.name.message}
            </span>
          ) : (
            <span className="type-caption text-muted-foreground">{summary}</span>
          )}
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Subir ${label}`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Bajar ${label}`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDownIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Quitar ${label}`}
          className="text-destructive"
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Controller
          control={control}
          name={`groups.${index}.required`}
          render={({ field }) => (
            <label className="flex h-12 items-center gap-3">
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label={`${label} obligatorio`}
              />
              <span className="type-body font-medium">Obligatorio</span>
            </label>
          )}
        />
        {required ? (
          <NumberField
            label="Mínimo"
            id={`groups-${index}-min`}
            error={errors?.min?.message}
            {...register(`groups.${index}.min`)}
          />
        ) : null}
        <NumberField
          label="Máximo"
          id={`groups-${index}-max`}
          error={errors?.max?.message}
          {...register(`groups.${index}.max`)}
        />
      </div>
      {errors?.min?.message || errors?.max?.message ? (
        <p role="alert" className="type-small -mt-2 text-destructive">
          {errors.min?.message ?? errors.max?.message}
        </p>
      ) : null}

      <ul className="grid gap-3">
        {options.fields.map((option, j) => {
          const optionErrors = errors?.options?.[j];
          return (
            <li
              key={option.key}
              className="grid grid-cols-[1fr_auto_auto] items-start gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_8rem_auto_auto] sm:border-0 sm:pb-0"
            >
              <div className="col-span-3 grid gap-1 sm:col-span-1">
                <Input
                  aria-label={`Opción ${j + 1} de ${label}`}
                  placeholder="Ej.: Grande"
                  aria-invalid={!!optionErrors?.name}
                  {...register(`groups.${index}.options.${j}.name`)}
                />
                {optionErrors?.name ? (
                  <span role="alert" className="type-caption text-destructive">
                    {optionErrors.name.message}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-1">
                <div className="relative">
                  <span className="type-small pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                    +Q
                  </span>
                  <Input
                    inputMode="decimal"
                    aria-label={`Precio extra de la opción ${j + 1} de ${label}`}
                    placeholder="0"
                    aria-invalid={!!optionErrors?.price}
                    className="pl-10"
                    {...register(`groups.${index}.options.${j}.price`)}
                  />
                </div>
                {optionErrors?.price ? (
                  <span role="alert" className="type-caption text-destructive">
                    {optionErrors.price.message}
                  </span>
                ) : null}
              </div>
              <Controller
                control={control}
                name={`groups.${index}.options.${j}.is_available`}
                render={({ field }) => (
                  <label className="flex h-12 items-center gap-2">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label={`Opción ${j + 1} de ${label} disponible`}
                    />
                    <span className="type-small text-muted-foreground">
                      {field.value ? "Hay" : "Agotada"}
                    </span>
                  </label>
                )}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Quitar opción ${j + 1} de ${label}`}
                onClick={() => options.remove(j)}
              >
                <Trash2Icon />
              </Button>
            </li>
          );
        })}
      </ul>
      {optionsError ? (
        <p role="alert" className="type-small text-destructive">
          {optionsError}
        </p>
      ) : null}
      {options.fields.length < MAX_OPTIONS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => options.append(newOption())}
        >
          <PlusIcon />
          Agregar opción
        </Button>
      ) : null}
    </fieldset>
  );
}

function NumberField({
  label,
  id,
  error,
  ...props
}: React.ComponentProps<"input"> & { label: string; id: string; error?: string }) {
  return (
    <label htmlFor={id} className="grid gap-1">
      <span className="type-small font-semibold">{label}</span>
      <Input
        id={id}
        inputMode="numeric"
        className="w-20 text-center"
        aria-invalid={!!error}
        {...props}
      />
    </label>
  );
}
