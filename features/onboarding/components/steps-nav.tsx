import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { ONBOARDING_STEPS, type Step } from "../onboarding";

/** Los 4 pasos arriba: el actual resaltado; los alcanzables se pueden tocar. */
export function StepsNav({ current, max }: { current: Step; max: Step }) {
  return (
    <nav aria-label="Pasos">
      <ol className="grid grid-cols-4 gap-2">
        {ONBOARDING_STEPS.map((s) => {
          const done = s.step < current;
          const reachable = s.step <= max && s.step !== current;
          const content = (
            <>
              <span
                className={cn("h-1.5 rounded-full", s.step <= current ? "bg-primary" : "bg-muted")}
              />
              <span className="type-caption flex items-center gap-1 font-semibold">
                {done ? <CheckIcon aria-hidden className="size-3.5 text-primary" /> : null}
                <span className="sr-only">Paso {s.step}: </span>
                <span className={cn(s.step !== current && "max-sm:sr-only")}>{s.title}</span>
              </span>
            </>
          );
          return (
            <li key={s.step}>
              {reachable ? (
                <Link
                  href={`/onboarding?paso=${s.step}`}
                  className="grid gap-1.5 rounded-sm text-muted-foreground hover:text-foreground"
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-current={s.step === current ? "step" : undefined}
                  className={cn(
                    "grid gap-1.5",
                    s.step === current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
