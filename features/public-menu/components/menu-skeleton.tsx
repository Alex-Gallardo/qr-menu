import { Skeleton } from "@/components/ui/skeleton";

/** Misma forma que el menú (portada, encabezado y tarjetas) para no saltar al cargar. */
export function MenuSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[480px]" aria-hidden>
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="-mt-10 grid gap-3 px-4">
        <Skeleton className="size-20 rounded-full border-4 border-background" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="mt-6 grid gap-3 px-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-3 rounded-lg border border-border bg-card p-3">
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <Skeleton className="aspect-[4/3] w-24 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
