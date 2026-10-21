import type { Metadata } from "next";
import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { PanelPage } from "@/features/panel/components/panel-page";
import { requireOwnerPage } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { BankAccountsManager } from "@/features/payments/components/bank-accounts-manager";
import { listBankAccounts } from "@/features/payments/server";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Cuentas para transferencia" };

export default function Page({ params }: PageProps<"/panel/[businessId]/ajustes/pagos">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Payments params={params} />
    </Suspense>
  );
}

async function Payments({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireOwnerPage(businessId, "ajustes/pagos");
  const [accounts, branches] = await Promise.all([
    listBankAccounts(businessId),
    db().branches.findMany({
      where: { business_id: businessId },
      orderBy: [{ sort: "asc" }, { created_at: "asc" }],
      select: { id: true, name: true, accepts_transfer: true },
    }),
  ]);
  const withoutTransfer = branches.filter((b) => !b.accepts_transfer);

  return (
    <PanelPage
      title="Cuentas para transferencia"
      description="Tus clientes las ven al elegir pagar por transferencia. Los pagos se hacen fuera de la app."
    >
      {withoutTransfer.length > 0 ? (
        <p className="type-small flex gap-2 rounded-md bg-nube px-4 py-3">
          <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            {withoutTransfer.map((b) => b.name).join(", ")}{" "}
            {withoutTransfer.length === 1 ? "no acepta" : "no aceptan"} transferencia. Puedes
            activarla en{" "}
            <Link href={panelHref(businessId, "sucursales")} className="font-semibold underline">
              Sucursales
            </Link>
            .
          </span>
        </p>
      ) : null}
      <BankAccountsManager
        businessId={businessId}
        accounts={accounts}
        branches={branches.map(({ id, name }) => ({ id, name }))}
      />
    </PanelPage>
  );
}
