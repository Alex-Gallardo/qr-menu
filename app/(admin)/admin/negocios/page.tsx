import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePlatform } from "@/features/admin/access";
import { can } from "@/features/admin/permissions";
import { listBusinesses } from "@/features/admin/queries";
import { formatDateEs, todayInGuatemala } from "@/lib/gt-time";

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
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="type-small w-full min-w-[44rem] border-collapse">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Negocio
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Dueño
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Plan
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Vence
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Pedidos 30 d
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/negocios/${b.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {b.name}
                    </Link>
                    <span className="block text-muted-foreground">
                      /{b.slug}
                      {b.published ? "" : " · sin publicar"}
                    </span>
                  </td>
                  <td className="px-3 py-2 break-all">{b.owner_email ?? "—"}</td>
                  <td className="px-3 py-2">
                    {b.plan_id ?? "—"}
                    {b.status ? (
                      <span className="block text-muted-foreground">{b.status}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {b.ends_at ? formatDateEs(todayInGuatemala(b.ends_at), now) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.orders_30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
