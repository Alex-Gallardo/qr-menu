import { CheckIcon, LockIcon } from "lucide-react";
import { cn } from "cn";
import { EditorSection } from "@/features/appearance/components/controls";
import { FEATURES, type Feature } from "@/features/licensing/plan-catalog";
import { FEATURE_LABELS, type usageRows } from "../billing";

type Usage = ReturnType<typeof usageRows>;

/** Plan, estado y vencimiento; uso contra límites; funciones incluidas. */
export function PlanOverview({
  planName,
  statusLabel,
  tone,
  detail,
  usage,
  features,
}: {
  planName: string;
  statusLabel: string;
  tone: "ok" | "warning" | "danger";
  /** "Vence el jueves 30 de octubre (en 7 días)". */
  detail: string | null;
  usage: Usage;
  features: readonly Feature[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <EditorSection title={`Plan ${planName}`}>
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "type-small rounded-full px-3 py-1 font-semibold",
              tone === "ok" && "bg-success/15 text-success",
              tone === "warning" && "bg-maiz/30 text-frijol",
              tone === "danger" && "bg-destructive/10 text-destructive",
            )}
          >
            {statusLabel}
          </span>
          {detail ? <span className="type-small text-muted-foreground">{detail}</span> : null}
        </p>
        <ul className="grid gap-3" aria-label="Uso de tu plan">
          {usage.map((u) => (
            <li key={u.resource} className="grid gap-1">
              <div className="type-small flex justify-between gap-3">
                <span>{u.label}</span>
                <span className={cn("tabular-nums", u.full && "font-semibold text-destructive")}>
                  {u.used} / {u.limit === null ? "∞" : u.limit === 0 ? "no incluido" : u.limit}
                </span>
              </div>
              {u.pct !== null ? (
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      u.full ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${u.pct}%` }}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </EditorSection>

      <EditorSection title="Funciones">
        <ul className="grid gap-2">
          {FEATURES.map((f) => {
            const on = features.includes(f);
            return (
              <li
                key={f}
                className={cn("type-small flex items-center gap-2", !on && "text-muted-foreground")}
              >
                {on ? (
                  <CheckIcon aria-hidden className="size-4 shrink-0 text-success" />
                ) : (
                  <LockIcon aria-hidden className="size-4 shrink-0" />
                )}
                <span>
                  {FEATURE_LABELS[f]}
                  <span className="sr-only">{on ? " (incluida)" : " (no incluida)"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </EditorSection>
    </div>
  );
}
