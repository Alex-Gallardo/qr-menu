"use client";

import { Switch } from "@/components/ui/switch";

/** "Todas las sucursales" o una lista con casillas (las nuevas sucursales entran solas con "Todas"). */
export function BranchPicker({
  id,
  branches,
  allBranches,
  branchIds,
  onChange,
  error,
}: {
  id: string;
  branches: { id: string; name: string }[];
  allBranches: boolean;
  branchIds: string[];
  onChange: (value: { allBranches: boolean; branchIds: string[] }) => void;
  error?: string;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="type-small mb-1 font-semibold">Sucursales</legend>
      <label className="flex items-center justify-between gap-3">
        <span className="type-body">
          Todas las sucursales
          <span className="type-caption block text-muted-foreground">
            Incluye las que agregues después.
          </span>
        </span>
        <Switch
          id={`${id}-todas`}
          aria-label="Todas las sucursales"
          checked={allBranches}
          onCheckedChange={(checked) => onChange({ allBranches: checked, branchIds })}
        />
      </label>
      {!allBranches ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {branches.map((b) => {
            const checked = branchIds.includes(b.id);
            return (
              <label
                key={b.id}
                className="type-body flex min-h-11 items-center gap-3 rounded-md border border-border px-3"
              >
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  aria-label={b.name}
                  checked={checked}
                  onChange={() =>
                    onChange({
                      allBranches,
                      branchIds: checked
                        ? branchIds.filter((x) => x !== b.id)
                        : [...branchIds, b.id],
                    })
                  }
                />
                {b.name}
              </label>
            );
          })}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="type-small text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
