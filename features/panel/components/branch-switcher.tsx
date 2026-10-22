"use client";

import { ChevronsUpDownIcon, StoreIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { cn } from "cn";
import { runAction } from "@/lib/action-client";
import { selectBranch } from "../actions";
import { ALL_BRANCHES } from "../branch-selection";
import type { PanelBranch } from "../context";

/**
 * Selector de sucursal. Un <select> nativo: en el celular abre el selector del
 * sistema (grande y accesible). "Todas" solo aparece para el dueño.
 */
export function BranchSwitcher({
  businessId,
  branches,
  selected,
  canSeeAll,
  className,
}: {
  businessId: string;
  branches: PanelBranch[];
  selected: string | null;
  canSeeAll: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(selected);

  if (branches.length === 0) return null;
  if (branches.length === 1) {
    return (
      <p className={cn("type-small flex h-10 items-center gap-2 font-semibold", className)}>
        <StoreIcon aria-hidden className="size-4 text-muted-foreground" />
        {branches[0]!.name}
      </p>
    );
  }

  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">Sucursal</span>
      <StoreIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <select
        value={optimistic ?? ""}
        disabled={pending}
        aria-busy={pending || undefined}
        onChange={(e) => {
          const branchId = e.target.value;
          startTransition(async () => {
            setOptimistic(branchId);
            const result = await runAction(() => selectBranch({ businessId, branchId }));
            if (result.ok) router.refresh();
          });
        }}
        className="type-small h-10 w-full cursor-pointer appearance-none rounded-md border border-border bg-card pr-9 pl-9 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-70"
      >
        {canSeeAll ? <option value={ALL_BRANCHES}>Todas</option> : null}
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.isActive ? "" : " (en pausa)"}
          </option>
        ))}
      </select>
      <ChevronsUpDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </label>
  );
}
