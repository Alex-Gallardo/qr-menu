"use server";

import { cookies } from "next/headers";
import { z } from "@/lib/zod";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { ALL_BRANCHES, branchCookieName } from "./branch-selection";

const selectBranchSchema = z.object({
  businessId: z.uuid(),
  branchId: z.union([z.uuid(), z.literal(ALL_BRANCHES)]),
});

/** Cambia la sucursal del selector (cookie). "Todas" solo para el dueño. */
export async function selectBranch(input: unknown): Promise<ActionResult> {
  const parsed = selectBranchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Esa sucursal no es válida." };
  const { businessId, branchId } = parsed.data;

  try {
    await requireAccess(
      businessId,
      branchId === ALL_BRANCHES ? { roles: ["owner"] } : { branchId },
    );
  } catch (error) {
    return actionError(error);
  }

  (await cookies()).set(branchCookieName(businessId), branchId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/panel",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}
