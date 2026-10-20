import type { ReactNode } from "react";

/** Encabezado y contenedor común de las páginas del panel. */
export function PanelPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-h1">{title}</h1>
          {description ? (
            <p className="type-body mt-1 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
