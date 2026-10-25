import Link from "next/link";
import type { EffectiveStatus } from "@/features/licensing/entitlements";
import { formatDateEs, todayInGuatemala } from "@/lib/gt-time";
import { LicenseStatusChip } from "./license-chip";

export type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  plan_id: string | null;
  status: string | null;
  ends_at: Date | null;
  owner_email: string | null;
  orders_30d: number;
};

/** Tabla de negocios del super admin: link, dueño, plan y estado, vencimiento y pedidos. */
export function BusinessesTable({ rows, now }: { rows: BusinessRow[]; now: Date }) {
  return (
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
                <span className="block">{b.plan_id ?? "—"}</span>
                {b.status ? <LicenseStatusChip status={b.status as EffectiveStatus} /> : null}
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
  );
}
