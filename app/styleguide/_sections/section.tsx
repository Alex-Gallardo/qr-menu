import type { ReactNode } from "react";

export function Section({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border py-10">
      <p className="type-caption font-semibold tracking-wider text-muted-foreground uppercase">
        {String(number).padStart(2, "0")}
      </p>
      <h2 className="type-h2 mt-1">{title}</h2>
      {description ? (
        <p className="type-small mt-2 max-w-prose text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
