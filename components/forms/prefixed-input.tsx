import { cn } from "cn";

/** Input con prefijo (+502, Q) o sufijo (km, min). */
export function PrefixedInput({
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
