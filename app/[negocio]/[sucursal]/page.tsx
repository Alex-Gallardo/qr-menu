import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BranchMenu, branchMetadata } from "@/features/public-menu/branch-page";
import { MenuSkeleton } from "@/features/public-menu/components/menu-skeleton";
import { MenuUnavailable } from "@/features/public-menu/components/menu-unavailable";
import { getPublicBusiness } from "@/features/public-menu/data";

/**
 * Menú público de una sucursal. Se genera en la primera visita y queda en
 * caché (etiquetas business/branch); cada cambio del panel lo invalida.
 */

async function load(params: Promise<{ negocio: string; sucursal: string }>) {
  const { negocio, sucursal } = await params;
  const business = await getPublicBusiness(negocio);
  const branch = business?.branches.find((b) => b.slug === sucursal);
  return { business, branch };
}

export async function generateMetadata({
  params,
}: PageProps<"/[negocio]/[sucursal]">): Promise<Metadata> {
  const { business, branch } = await load(params);
  if (!business || !branch) return { title: "Menú no encontrado", robots: { index: false } };
  return branchMetadata(business, branch);
}

export default function Page({ params }: PageProps<"/[negocio]/[sucursal]">) {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ negocio: string; sucursal: string }> }) {
  const { business, branch } = await load(params);
  if (!business || !branch) notFound();
  if (!business.menuOnline) return <MenuUnavailable businessName={business.name} />;
  return <BranchMenu business={business} branch={branch} />;
}
