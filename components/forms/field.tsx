import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Etiqueta + control + ayuda o error, con los ids de accesibilidad conectados. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="type-small text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="type-small text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Mensaje de resultado de un formulario (error o éxito). */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "type-small rounded-md bg-destructive/10 px-4 py-3 text-destructive"
          : "type-small rounded-md bg-success/10 px-4 py-3 text-success"
      }
    >
      {children}
    </p>
  );
}
