"use client";

import { LockIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "cn";

/** Tarjeta de una sección del editor. */
export function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="@container grid gap-4 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
      <div className="grid gap-1">
        <h2 className="type-h3">{title}</h2>
        {description ? <p className="type-small text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Grupo de botones tipo píldora (una opción a la vez). */
export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly { value: T; label: string; locked?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-1.5">
      <span className="type-small font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            disabled={disabled || o.locked}
            onClick={() => onChange(o.value)}
            className="type-small inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {o.locked ? <LockIcon aria-hidden className="size-3.5" /> : null}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Aviso amable de función que el plan no incluye. */
export function PlanLock({
  children,
  licenseHref,
  className,
}: {
  children: ReactNode;
  licenseHref: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "type-small flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted px-3 py-2 text-muted-foreground",
        className,
      )}
    >
      <LockIcon aria-hidden className="size-4 shrink-0" />
      <span>{children}</span>
      <Link
        href={licenseHref}
        className="font-semibold text-primary underline-offset-4 hover:underline"
      >
        Ver mi plan
      </Link>
    </p>
  );
}

/** Selector de color: muestra nativa + código hex editable. */
export function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  // Lo que se escribe; se aplica apenas es un código válido y se sincroniza
  // si el color cambia desde fuera (paleta, sugerencia de contraste).
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  const toHex = (text: string) => {
    const v = text.trim().toUpperCase();
    const hex = v.startsWith("#") ? v : `#${v}`;
    return /^#[0-9A-F]{6}$/.test(hex) ? hex : null;
  };

  return (
    <label className="grid gap-1.5">
      <span className="type-small font-semibold">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-md border border-input bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label}: elegir color`}
          className="size-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
        />
        <input
          type="text"
          value={draft}
          disabled={disabled}
          maxLength={7}
          spellCheck={false}
          aria-label={`${label}: código`}
          onChange={(e) => {
            setDraft(e.target.value);
            const hex = toHex(e.target.value);
            if (hex && hex !== value) onChange(hex);
          }}
          onBlur={() => setDraft(value)}
          className="type-body w-full min-w-0 bg-transparent font-mono uppercase outline-none"
        />
      </span>
    </label>
  );
}
