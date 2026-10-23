"use client";

import { ExternalLinkIcon, StarIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { runAction } from "@/lib/action-client";
import { markGoogleClickAction, submitReviewAction } from "../actions";
import { MAX_REVIEW_COMMENT, reviewThanks, STAR_LABELS } from "../reviews";
import type { OrderReview } from "../server";

/**
 * "¿Qué tal estuvo todo?" en la confirmación del pedido (con los colores del
 * menú). Al enviar, a TODOS se les ofrece publicar también en Google: solo el
 * agradecimiento cambia según la calificación.
 */
export function ReviewCard({ orderId, initial }: { orderId: string; initial: OrderReview }) {
  const [sent, setSent] = useState(initial.review);
  const [googleUrl, setGoogleUrl] = useState(initial.googleUrl);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const commentId = useId();

  async function submit() {
    if (!rating || pending) return;
    setPending(true);
    const res = await runAction(() =>
      submitReviewAction({ orderId, rating, comment: comment.trim() || null }),
    );
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setGoogleUrl(res.data.googleUrl);
    setSent({ rating, comment: comment.trim() || null });
  }

  const shown = hover || rating;

  if (sent)
    return (
      <section
        aria-live="polite"
        className="grid justify-items-center gap-3 rounded-[var(--menu-radius)] border border-[var(--menu-line)] bg-[var(--menu-surface)] p-4 text-center"
      >
        <Stars rating={sent.rating} />
        <p className="type-body font-semibold">{reviewThanks(sent.rating)}</p>
        {googleUrl ? (
          <>
            <p className="type-small text-[var(--menu-muted)]">
              ¿Nos ayudas a que más personas nos conozcan?
            </p>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void markGoogleClickAction(orderId)}
              className="type-body inline-flex h-12 items-center gap-2 rounded-full border border-[var(--menu-line)] px-5 font-semibold transition-transform active:scale-[0.97]"
            >
              <ExternalLinkIcon aria-hidden className="size-4" />
              Publicar también en Google
            </a>
          </>
        ) : null}
      </section>
    );

  return (
    <section
      aria-labelledby={`${commentId}-title`}
      className="grid gap-3 rounded-[var(--menu-radius)] border border-[var(--menu-line)] bg-[var(--menu-surface)] p-4"
    >
      <h2 id={`${commentId}-title`} className="type-h3 text-center">
        ¿Qué tal estuvo todo?
      </h2>
      <div
        role="radiogroup"
        aria-label="Calificación"
        className="flex justify-center gap-1"
        onPointerLeave={() => setHover(0)}
      >
        {STAR_LABELS.map((label, i) => {
          const value = i + 1;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}: ${label}`}
              onClick={() => setRating(value)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(value)}
              className="grid size-12 place-items-center rounded-full transition-transform active:scale-90"
            >
              <StarIcon
                aria-hidden
                className={cn(
                  "size-9 transition-colors",
                  value <= shown ? "fill-maiz text-maiz" : "text-[var(--menu-line)]",
                )}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      <p className="type-small min-h-5 text-center font-semibold text-[var(--menu-muted)]">
        {shown ? STAR_LABELS[shown - 1] : "Toca las estrellas"}
      </p>
      {rating ? (
        <>
          <label htmlFor={commentId} className="type-small font-semibold">
            ¿Algo que quieras contarnos? (opcional)
          </label>
          <textarea
            id={commentId}
            value={comment}
            maxLength={MAX_REVIEW_COMMENT}
            rows={3}
            onChange={(e) => setComment(e.target.value)}
            className="type-body w-full resize-none rounded-[calc(var(--menu-radius)/1.5)] border border-[var(--menu-line)] bg-transparent px-3 py-2 outline-none focus-visible:border-[var(--menu-primary)]"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={pending}
            className="type-body flex h-12 items-center justify-center rounded-full bg-[var(--menu-primary)] px-4 font-semibold text-[var(--menu-on-primary)] transition-transform active:scale-[0.97] disabled:opacity-70"
          >
            {pending ? "Enviando…" : "Enviar calificación"}
          </button>
        </>
      ) : null}
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} de 5 estrellas`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          aria-hidden
          className={cn("size-6", n <= rating ? "fill-maiz text-maiz" : "text-[var(--menu-line)]")}
        />
      ))}
    </span>
  );
}
