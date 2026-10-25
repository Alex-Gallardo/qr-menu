import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePlatform } from "@/features/admin/access";
import { listAudit } from "@/features/admin/queries";
import { formatWhenGT } from "@/lib/gt-time";

export const metadata: Metadata = { title: "Auditoría" };

/** Auditoría de todo (negocios y plataforma), con filtro por negocio y acción. */
export default function Page({ searchParams }: PageProps<"/admin/auditoria">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}

async function Audit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatform("audit.view", "/admin/auditoria");
  const q = await searchParams;
  const businessId =
    typeof q.negocio === "string" && /^[0-9a-f-]{36}$/i.test(q.negocio) ? q.negocio : undefined;
  const action = typeof q.accion === "string" ? q.accion.slice(0, 60) : "";
  const page = Math.max(0, Number(q.p) || 0);
  const { rows, total } = await listAudit({ businessId, action: action || undefined, page });
  const now = new Date();
  const href = (p: number) =>
    `/admin/auditoria?${new URLSearchParams({
      ...(businessId ? { negocio: businessId } : {}),
      ...(action ? { accion: action } : {}),
      p: String(p),
    })}`;

  return (
    <>
      <h1 className="type-h1">Auditoría</h1>
      <form className="flex flex-wrap gap-2" role="search">
        {businessId ? <input type="hidden" name="negocio" value={businessId} /> : null}
        <Input
          name="accion"
          defaultValue={action}
          placeholder="Acción (ej. license, payment, support, team)"
          aria-label="Filtrar por acción"
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        {businessId || action ? (
          <Button asChild variant="ghost">
            <Link href="/admin/auditoria">Quitar filtros</Link>
          </Button>
        ) : null}
      </form>
      <p className="type-small text-muted-foreground">{total} registros</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="type-small w-full min-w-[48rem] border-collapse">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="px-3 py-2 font-semibold">
                Cuándo
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Quién
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Negocio
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Acción
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Detalle
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border align-top last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">{formatWhenGT(r.created_at, now)}</td>
                <td className="px-3 py-2">
                  {r.actor ?? "—"}
                  <span className="block text-muted-foreground">{r.actor_kind}</span>
                </td>
                <td className="px-3 py-2">
                  {r.business && r.business_id ? (
                    <Link
                      href={`/admin/negocios/${r.business_id}`}
                      className="text-primary hover:underline"
                    >
                      {r.business}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 font-mono">{r.action}</td>
                <td className="max-w-md px-3 py-2 break-all text-muted-foreground">
                  {r.diff ? JSON.stringify(r.diff) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        {page > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page - 1)}>Más recientes</Link>
          </Button>
        ) : null}
        {(page + 1) * 50 < total ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page + 1)}>Anteriores</Link>
          </Button>
        ) : null}
      </div>
    </>
  );
}
