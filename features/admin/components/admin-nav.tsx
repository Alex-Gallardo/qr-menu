"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

/** Pestañas del super admin (las que permite el rol). */
export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Super admin" className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "type-small shrink-0 border-b-2 px-3 py-2.5 font-semibold transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
