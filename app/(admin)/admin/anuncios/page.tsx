import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { requirePlatform } from "@/features/admin/access";
import { AnnouncementsManager } from "@/features/admin/components/announcements-manager";
import { listAnnouncements } from "@/features/admin/settings";
import { todayInGuatemala } from "@/lib/gt-time";

export const metadata: Metadata = { title: "Anuncios" };

/** Banners en los paneles de los negocios, por audiencia. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Announcements />
    </Suspense>
  );
}

async function Announcements() {
  await requirePlatform("settings.edit", "/admin/anuncios");
  const rows = await listAnnouncements();
  return (
    <>
      <h1 className="type-h1">Anuncios</h1>
      <AnnouncementsManager
        today={todayInGuatemala()}
        rows={rows.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          audience: a.audience,
          startsAt: todayInGuatemala(a.starts_at),
          endsAt: a.ends_at ? todayInGuatemala(a.ends_at) : "",
          isActive: a.is_active,
        }))}
      />
    </>
  );
}
