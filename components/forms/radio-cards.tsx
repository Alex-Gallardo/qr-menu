"use client";

/** Opciones como tarjetas con título y explicación (una a la vez). */
export function RadioCards<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "grid gap-2 sm:grid-cols-3",
}: {
  label: string;
  options: readonly { value: T; title: string; text: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className="grid gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 aria-checked:border-primary aria-checked:bg-primary/5 aria-checked:ring-2 aria-checked:ring-primary/30"
        >
          <span className="type-small font-semibold">{o.title}</span>
          <span className="type-caption text-muted-foreground">{o.text}</span>
        </button>
      ))}
    </div>
  );
}
