"use client";

import { CopyIcon, EyeIcon, EyeOffIcon, ExternalLinkIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Choice, EditorSection } from "@/features/appearance/components/controls";
import { runAction } from "@/lib/action-client";
import { cn } from "cn";
import { setReviewHiddenAction } from "../actions";
import { summarizeReviews } from "../reviews";

export type BoardReview = {
  id: string;
  branchId: string;
  rating: number;
  comment: string | null;
  customerName: string | null;
  orderNumber: number | null;
  hidden: boolean;
  clickedGoogle: boolean;
  /** Fecha ya formateada en el servidor (Guatemala). */
  when: string;
};

type Branch = { id: string; name: string; googleUrl: string | null };

const ALL = "all";
/** Meta de la guía: al menos 3 de cada 10 que califican tocan "Publicar en Google". */
const GOOGLE_GOAL = 30;

/**
 * Reseñas del panel: promedio y distribución por sucursal, cuántos pasaron a
 * Google y los comentarios (se pueden ocultar; siguen contando en el promedio).
 */
export function ReviewsBoard({
  businessId,
  branches,
  initialBranchId,
  reviews,
  branchesHref,
}: {
  businessId: string;
  branches: Branch[];
  initialBranchId: string;
  reviews: BoardReview[];
  /** Base de Sucursales: el Place ID se agrega en {branchesHref}/{id}. */
  branchesHref: string;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(initialBranchId);
  const [hiddenOverride, setHiddenOverride] = useState<Record<string, boolean>>({});
  const [showHidden, setShowHidden] = useState(false);

  const branch = branches.find((b) => b.id === branchId) ?? null;
  const list = useMemo(
    () =>
      reviews
        .filter((r) => branchId === ALL || r.branchId === branchId)
        .map((r) => ({ ...r, hidden: hiddenOverride[r.id] ?? r.hidden })),
    [reviews, branchId, hiddenOverride],
  );
  const summary = summarizeReviews(
    list.map((r) => ({ rating: r.rating, clicked_google: r.clickedGoogle })),
  );
  const comments = list.filter((r) => r.comment && (showHidden || !r.hidden));
  const hiddenCount = list.filter((r) => r.comment && r.hidden).length;
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";

  async function toggle(review: BoardReview, hidden: boolean) {
    setHiddenOverride((o) => ({ ...o, [review.id]: hidden }));
    const res = await runAction(() =>
      setReviewHiddenAction({ businessId, reviewId: review.id, hidden }),
    );
    if (!res.ok) {
      setHiddenOverride((o) => ({ ...o, [review.id]: !hidden }));
      toast.error(res.message);
      return;
    }
    router.refresh();
    toast(res.message, {
      duration: 6000,
      action: {
        label: "Deshacer",
        onClick: () => void toggle(review, !hidden),
      },
    });
  }

  return (
    <div className="grid gap-6">
      {branches.length > 1 ? (
        <Choice
          label="Sucursal"
          value={branchId}
          onChange={setBranchId}
          options={[
            { value: ALL, label: "Todas" },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
      ) : null}

      <EditorSection
        title={branch ? `Calificación de ${branch.name}` : "Calificación de todas tus sucursales"}
        description="Cada pedido se puede calificar una vez, cuando se entrega (o 2 horas después de pedir)."
      >
        {summary.count === 0 ? (
          <p className="type-body text-muted-foreground">
            Todavía no hay reseñas. Aparecen aquí cuando tus clientes califican su pedido desde la
            confirmación.
          </p>
        ) : (
          <div className="grid gap-6 @xl:grid-cols-[auto_1fr] @xl:items-center">
            <div className="grid justify-items-start gap-1">
              <p className="type-display leading-none font-bold tabular-nums">
                {summary.average?.toFixed(1)}
              </p>
              <Stars rating={Math.round(summary.average ?? 0)} />
              <p className="type-small text-muted-foreground">
                {summary.count} {summary.count === 1 ? "reseña" : "reseñas"}
              </p>
            </div>
            <ul className="grid gap-1.5" aria-label="Distribución de estrellas">
              {summary.distribution.map((n, i) => {
                const stars = 5 - i;
                const pct = Math.round((n / summary.count) * 100);
                return (
                  <li
                    key={stars}
                    className="type-small grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2"
                  >
                    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                      {stars}
                      <StarIcon aria-hidden className="size-3.5 fill-maiz text-maiz" />
                    </span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-maiz"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">{n}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </EditorSection>

      <EditorSection
        title="Reseñas en Google"
        description="A todos los que califican les ofrecemos publicar también en Google (Google no permite pedírselo solo a los contentos)."
      >
        {summary.googleRate !== null ? (
          <div className="grid gap-2">
            <p className="type-body">
              <span className="font-bold tabular-nums">{summary.googleRate} %</span> de los que
              calificaron tocaron &quot;Publicar también en Google&quot;.
            </p>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  "block h-full rounded-full",
                  summary.googleRate >= GOOGLE_GOAL ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${summary.googleRate}%` }}
              />
              <span
                aria-hidden
                className="absolute inset-y-0 w-0.5 bg-foreground/50"
                style={{ left: `${GOOGLE_GOAL}%` }}
              />
            </div>
            <p className="type-small text-muted-foreground">
              {summary.googleRate >= GOOGLE_GOAL
                ? "¡Vas por encima de la meta (30 %)!"
                : "Meta: 30 %. Un buen servicio y recordarlo en la mesa ayudan."}
            </p>
          </div>
        ) : null}
        <GoogleLinks branches={branch ? [branch] : branches} branchesHref={branchesHref} />
      </EditorSection>

      <EditorSection
        title="Comentarios"
        description="Ocultar un comentario lo quita de esta lista; la calificación sigue contando en el promedio."
      >
        {comments.length === 0 ? (
          <p className="type-body text-muted-foreground">
            {hiddenCount > 0 && !showHidden
              ? "Los comentarios de aquí están ocultos."
              : "Todavía no hay comentarios."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {comments.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "grid gap-2 rounded-lg border border-border p-4",
                  r.hidden && "bg-muted/60",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars rating={r.rating} />
                  <span className="type-small text-muted-foreground">{r.when}</span>
                </div>
                <p
                  className={cn(
                    "type-body whitespace-pre-line",
                    r.hidden && "text-muted-foreground",
                  )}
                >
                  {r.comment}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="type-small text-muted-foreground">
                    {[
                      r.customerName,
                      r.orderNumber !== null
                        ? `Pedido #${String(r.orderNumber).padStart(4, "0")}`
                        : null,
                      branchId === ALL ? branchName(r.branchId) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void toggle(r, !r.hidden)}
                  >
                    {r.hidden ? <EyeIcon aria-hidden /> : <EyeOffIcon aria-hidden />}
                    {r.hidden ? "Mostrar" : "Ocultar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hiddenCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() => setShowHidden((v) => !v)}
          >
            {showHidden ? "No ver los ocultos" : `Ver los ocultos (${hiddenCount})`}
          </Button>
        ) : null}
      </EditorSection>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      aria-label={`${rating} de 5 estrellas`}
      className="inline-flex items-center gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          aria-hidden
          className={cn("size-4", n <= rating ? "fill-maiz text-maiz" : "text-border")}
        />
      ))}
    </span>
  );
}

function GoogleLinks({ branches, branchesHref }: { branches: Branch[]; branchesHref: string }) {
  return (
    <ul className="grid gap-2">
      {branches.map((b) => (
        <li
          key={b.id}
          className="type-small flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2"
        >
          <span className="font-semibold">{b.name}</span>
          {b.googleUrl ? (
            <span className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void copy(b.googleUrl!)}
              >
                <CopyIcon aria-hidden />
                Copiar enlace
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={b.googleUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon aria-hidden />
                  Probar
                </a>
              </Button>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Sin Place ID de Google: el botón no aparece.{" "}
              <Link
                href={`${branchesHref}/${b.id}`}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Agregarlo en Sucursales
              </Link>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Enlace copiado.");
  } catch {
    toast.error("No se pudo copiar.");
  }
}
