import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton genérico de página mientras llega el contenido que depende de la sesión. */
export function PageSkeleton() {
  return (
    <div className="mx-auto grid max-w-landing gap-4 px-4 py-10" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full rounded-sm" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
