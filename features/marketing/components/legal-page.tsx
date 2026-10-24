import type { ReactNode } from "react";

/** Marco de las páginas legales: título, fecha y secciones con buena lectura. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <div className="grid gap-1">
        <h1 className="type-h1">{title}</h1>
        <p className="text-sm text-muted-foreground">Última actualización: {updated}</p>
      </div>
      <div className="grid gap-6 leading-relaxed [&_h2]:type-h3 [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_section]:grid [&_section]:gap-2 [&_ul]:grid [&_ul]:gap-1 [&_ul]:text-muted-foreground">
        {children}
      </div>
    </main>
  );
}
