import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { getProfile, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/** /panel → el primer negocio del usuario; sin negocio → onboarding (o super admin). */
export default function PanelIndexPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResolveBusiness />
    </Suspense>
  );
}

async function ResolveBusiness(): Promise<never> {
  const user = await requireUser("/panel");
  const membership = await db().business_members.findFirst({
    where: { user_id: user.id },
    orderBy: { created_at: "asc" },
    select: { business_id: true },
  });
  if (membership) redirect(`/panel/${membership.business_id}`);

  const profile = await getProfile(user.id);
  redirect(profile && profile.platform_role !== "none" ? "/admin" : "/onboarding");
}
