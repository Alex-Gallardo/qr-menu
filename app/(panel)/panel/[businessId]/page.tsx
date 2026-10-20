import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Logo } from "@/components/brand/logo";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/** Inicio provisional del panel. El layout completo (sidebar, sucursales) llega en QRM-009. */
export default function BusinessHomePage({ params }: PageProps<"/panel/[businessId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BusinessHome params={params} />
    </Suspense>
  );
}

async function BusinessHome({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!z.uuid().safeParse(businessId).success) notFound();

  const user = await requireUser(`/panel/${businessId}`);
  const member = await db().business_members.findUnique({
    where: { business_id_user_id: { business_id: businessId, user_id: user.id } },
    select: { role: true, business: { select: { name: true } } },
  });
  // Sin membresía: 404, no se revela que el negocio existe.
  if (!member) notFound();

  return (
    <main className="mx-auto grid max-w-landing gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <SignOutButton />
      </header>
      <div>
        <p className="type-caption font-semibold tracking-wider text-muted-foreground uppercase">
          {member.role === "owner" ? "Dueño" : "Encargado"}
        </p>
        <h1 className="type-h1">{member.business.name}</h1>
        <p className="type-body mt-2 text-muted-foreground">
          Entraste como {user.email}. El panel completo llega en los próximos tickets.
        </p>
      </div>
    </main>
  );
}
