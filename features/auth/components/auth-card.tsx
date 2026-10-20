import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center" aria-label="Inicio">
          <Logo />
        </Link>
        <div className="rounded-xl border border-border bg-card p-6 shadow-2 sm:p-8">
          <h1 className="type-h2">{title}</h1>
          {subtitle ? <p className="type-small mt-1 text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

/** Esqueleto con la misma forma del formulario mientras llega la parte dinámica. */
export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="grid animate-pulse gap-4" aria-hidden>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="grid gap-2">
          <div className="h-4 w-24 rounded-sm bg-muted" />
          <div className="h-12 rounded-md bg-muted" />
        </div>
      ))}
      <div className="h-12 rounded-md bg-muted" />
    </div>
  );
}
