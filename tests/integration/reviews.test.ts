import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewSchema } from "@/features/reviews/schemas";
import {
  branchGoogleUrls,
  getOrderReview,
  listReviews,
  markGoogleClick,
  reviewBranch,
  setReviewHidden,
  submitReview,
} from "@/features/reviews/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/** QRM-037: reseñas por sucursal (una por pedido) y botón de Google. */

const DAY = 24 * 60 * 60 * 1000;
const HOURS_3 = 3 * 60 * 60 * 1000;
const SLUG = "zz-test-qrm037-resenas";
const PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";
const GOOGLE_URL = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`;
let businessId: string;
let centro: string;
let norte: string;
let actorId: string;
let nextNumber = 1;

type Status = "new" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled";

async function order(
  status: Status,
  { agoMs = 0, branch }: { agoMs?: number; branch?: string } = {},
) {
  return db().orders.create({
    data: {
      business_id: businessId,
      branch_id: branch ?? centro,
      number: nextNumber++,
      customer_name: "Ana",
      order_type: "takeout",
      payment_method: "cash",
      subtotal_cents: 5000,
      total_cents: 5000,
      status,
      created_at: new Date(Date.now() - agoMs),
    },
    select: { id: true },
  });
}

const input = (raw: Record<string, unknown>) => reviewSchema.parse(raw);
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e as AppError,
  );

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba reseñas",
      license: {
        create: { plan_id: "pro", status: "active", ends_at: new Date(Date.now() + 30 * DAY) },
      },
      branches: {
        create: [
          {
            slug: "centro",
            name: "Centro",
            whatsapp_e164: "+50255550000",
            google_place_id: PLACE_ID,
          },
          { slug: "norte", name: "Norte", whatsapp_e164: "+50255550001" },
        ],
      },
    },
    select: { id: true, branches: { select: { id: true, slug: true } } },
  });
  businessId = biz.id;
  centro = biz.branches.find((b) => b.slug === "centro")!.id;
  norte = biz.branches.find((b) => b.slug === "norte")!.id;
  const owner = await db().business_members.findFirst({ where: { role: "owner" } });
  if (!owner) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  actorId = owner.user_id;
});

afterAll(async () => {
  if (businessId) {
    await db().analytics_events.deleteMany({ where: { business_id: businessId } });
    await db().audit_logs.deleteMany({ where: { business_id: businessId } });
  }
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().$disconnect();
});

describe("reseñas", () => {
  it("pedido entregado: se califica una vez, con su sucursal y el botón de Google", async () => {
    const o = await order("delivered");
    expect(await getOrderReview(o.id)).toEqual({ open: true, review: null, googleUrl: GOOGLE_URL });

    const res = await submitReview(input({ orderId: o.id, rating: 5, comment: "¡Riquísimo!" }));
    expect(res.googleUrl).toBe(GOOGLE_URL);

    const saved = await db().reviews.findUniqueOrThrow({ where: { order_id: o.id } });
    expect(saved).toMatchObject({
      business_id: businessId,
      branch_id: centro,
      rating: 5,
      comment: "¡Riquísimo!",
      customer_name: "Ana",
      clicked_google: false,
    });
    const event = await db().analytics_events.findFirst({
      where: { business_id: businessId, event: "review_submitted", session_id: o.id },
    });
    expect(event?.branch_id).toBe(centro);

    const again = await failure(submitReview(input({ orderId: o.id, rating: 1 })));
    expect(again).toBeInstanceOf(AppError);
    expect(again?.code).toBe("already_reviewed");
    expect((await getOrderReview(o.id))?.review).toEqual({ rating: 5, comment: "¡Riquísimo!" });

    await markGoogleClick(o.id);
    const clicked = await db().reviews.findUniqueOrThrow({ where: { order_id: o.id } });
    expect(clicked.clicked_google).toBe(true);
  });

  it("recién pedido: todavía no; a las 2 h sin marcar entregado, sí", async () => {
    const fresh = await order("preparing");
    expect((await getOrderReview(fresh.id))?.open).toBe(false);
    const early = await failure(submitReview(input({ orderId: fresh.id, rating: 4 })));
    expect(early?.code).toBe("too_early");

    const old = await order("ready", { agoMs: HOURS_3 });
    await submitReview(input({ orderId: old.id, rating: 3 }));
    expect(await db().reviews.count({ where: { order_id: old.id } })).toBe(1);
  });

  it("cancelado: no se califica", async () => {
    const o = await order("cancelled", { agoMs: HOURS_3 });
    const error = await failure(submitReview(input({ orderId: o.id, rating: 1 })));
    expect(error?.userMessage).toMatch(/cancel/);
  });

  it("sucursal sin Place ID: se guarda igual, sin botón de Google", async () => {
    const o = await order("delivered", { branch: norte });
    const res = await submitReview(input({ orderId: o.id, rating: 2 }));
    expect(res.googleUrl).toBeNull();
    expect(await branchGoogleUrls(businessId, [centro, norte])).toEqual({
      [centro]: GOOGLE_URL,
      [norte]: null,
    });
  });

  it("panel: lista por sucursal; ocultar queda auditado y la reseña sigue contando", async () => {
    const list = await listReviews(businessId, [centro]);
    expect(list.map((r) => r.rating).sort()).toEqual([3, 5]);
    expect(list.every((r) => r.branchId === centro)).toBe(true);
    const withComment = list.find((r) => r.comment)!;
    expect(withComment.orderNumber).toBeGreaterThan(0);
    expect(withComment.clickedGoogle).toBe(true);

    expect(await reviewBranch(businessId, withComment.id)).toBe(centro);
    await setReviewHidden(businessId, withComment.id, true, { actorId });
    const after = await listReviews(businessId, [centro]);
    expect(after).toHaveLength(2);
    expect(after.find((r) => r.id === withComment.id)?.hidden).toBe(true);
    expect(
      await db().audit_logs.count({
        where: { business_id: businessId, action: "review.hide", entity_id: withComment.id },
      }),
    ).toBe(1);

    // De otro negocio no se puede tocar.
    const foreign = await failure(
      setReviewHidden(crypto.randomUUID(), withComment.id, false, { actorId }),
    );
    expect(foreign?.code).toBe("not_found");
    expect(await listReviews(businessId, [norte])).toHaveLength(1);
  });
});
