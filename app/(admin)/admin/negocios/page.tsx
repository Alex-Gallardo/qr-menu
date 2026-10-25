import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePlatform } from "@/features/admin/access";
import { BusinessesTable } from "@/features/admin/components/businesses-table";
import { can } from "@/features/admin/permissions";
import { listBusinesses } from "@/features/admin/queries";

export const metadata: Metadata = { title: "Negocios" };

/** Negocios: búsqueda por nombre, link o correo del dueño. */
export default function Page({ searchParams }: PageProps<"/admin/negocios">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Businesses searchParams={searchParams} />
    </Suspense>
  );
}

async function Businesses({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requirePlatform("businesses.view", "/admin/negocios");
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 80) : "";
  const rows = await listBusinesses(q);
  const now = new Date();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">Negocios</h1>
        {can(profile.platform_role, "businesses.create") ? (
          <Button asChild>
            <Link href="/admin/negocios/nuevo">Crear negocio</Link>
          </Button>
        ) : null}
      </div>
      <form className="flex gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Nombre, link o correo del dueño"
          aria-label="Buscar negocio"
        />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>
      {rows.length === 0 ? (
        <p className="type-body text-muted-foreground">Sin resultados.</p>
      ) : (
        <BusinessesTable rows={rows} now={now} />
      )}
    </>
  );
}
