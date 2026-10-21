import type { ReactNode } from "react";

/** Estado vacío que enseña qué hacer después (no solo "no hay datos"). */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      {icon ? (
        <div className="grid size-14 place-items-center rounded-full bg-nube text-primary [&_svg]:size-7">
          {icon}
        </div>
      ) : null}
      <h2 className="type-h3">{title}</h2>
      {children ? <p className="type-small max-w-sm text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
