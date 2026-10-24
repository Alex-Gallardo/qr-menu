"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { isActive, MOBILE_TABS, panelHref, type NavGroup } from "../nav";
import { NavIcon } from "./nav-icon";

/** Barra lateral de escritorio (≥ 1024 px). */
export function SidebarNav({ businessId, groups }: { businessId: string; groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="grid gap-5">
      {groups.map((group, gi) => (
        <div key={group.label ?? gi} className="grid gap-0.5">
          {group.label ? (
            <p className="type-caption px-3 pb-1 font-semibold tracking-wider text-muted-foreground uppercase">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(pathname, businessId, item.segment);
            return (
              <Link
                key={item.segment}
                href={panelHref(businessId, item.segment)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "type-small flex h-10 items-center gap-3 rounded-md px-3 font-medium transition-colors",
                  active
                    ? "bg-card font-semibold text-foreground shadow-1"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <NavIcon
                  name={item.icon}
                  className={cn("size-5", active ? "text-primary" : "text-current")}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Pestañas inferiores en móvil: Pedidos, Menú, Inicio, Más. */
export function BottomTabs({ businessId, className }: { businessId: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones principales"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden",
        className,
      )}
    >
      <ul className="mx-auto grid max-w-landing grid-cols-4">
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, businessId, tab.segment);
          return (
            <li key={tab.segment}>
              <Link
                href={panelHref(businessId, tab.segment)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "type-caption flex h-16 flex-col items-center justify-center gap-1 font-semibold transition-colors active:scale-[0.96]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <NavIcon name={tab.icon} className="size-6" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
