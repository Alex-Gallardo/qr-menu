"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { tags } from "@/lib/cache-tags";
import { ACCOUNT_TYPES, bankAccountSchema } from "./schemas";
import {
  createBankAccount,
  deleteBankAccount,
  moveBankAccount,
  restoreBankAccount,
  setBankAccountActive,
  updateBankAccount,
  type BankAccountRow,
} from "./server";

/** Después de escribir: el menú público muestra las cuentas al instante. */
const published = (businessId: string) => updateTag(tags.business(businessId));

/** Cuentas bancarias: solo el dueño (tabla de permisos de la guía). */
async function ownerOf(businessId: string) {
  const { user } = await requireAccess(businessId, { roles: ["owner"], write: true });
  return { actorId: user.id };
}

const firstIssue = (error: z.ZodError) => ({
  ok: false as const,
  message: error.issues[0]?.message ?? "Revisa los datos.",
});

export async function saveBankAccount(input: unknown): Promise<ActionResult> {
  const parsed = bankAccountSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const ctx = await ownerOf(parsed.data.businessId);
    const { accountId } = parsed.data;
    if (accountId) {
      await updateBankAccount({ ...parsed.data, accountId }, ctx);
      published(parsed.data.businessId);
      return { ok: true, message: "¡Listo! Guardamos la cuenta." };
    }
    await createBankAccount(parsed.data, ctx);
    published(parsed.data.businessId);
    return { ok: true, message: "¡Listo! Agregamos la cuenta." };
  } catch (error) {
    return actionError(error);
  }
}

const idsSchema = z.object({ businessId: z.uuid(), accountId: z.uuid() });

export async function removeBankAccount(
  input: unknown,
): Promise<ActionResult<{ account: BankAccountRow }>> {
  const parsed = idsSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const ctx = await ownerOf(parsed.data.businessId);
    const account = await deleteBankAccount(parsed.data.businessId, parsed.data.accountId, ctx);
    published(parsed.data.businessId);
    return { ok: true, data: { account } };
  } catch (error) {
    return actionError(error);
  }
}

/** La fila viene del navegador: se valida completa antes de recrearla. */
const snapshotSchema = z.object({
  businessId: z.uuid(),
  account: z.object({
    id: z.uuid(),
    bank_name: z.string().min(1).max(60),
    account_type: z.enum(ACCOUNT_TYPES),
    account_number: z.string().min(1).max(40),
    holder_name: z.string().min(1).max(80),
    instructions: z.string().max(200).nullable(),
    branch_id: z.uuid().nullable(),
    is_active: z.boolean(),
    sort: z.number().int().min(0).max(1000),
  }),
});

export async function undoRemoveBankAccount(input: unknown): Promise<ActionResult> {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const ctx = await ownerOf(parsed.data.businessId);
    await restoreBankAccount(parsed.data.businessId, parsed.data.account, ctx);
    published(parsed.data.businessId);
    return { ok: true, message: "Recuperamos la cuenta." };
  } catch (error) {
    return actionError(error);
  }
}

export async function moveBankAccountAction(input: unknown): Promise<ActionResult> {
  const parsed = idsSchema
    .extend({ direction: z.union([z.literal(-1), z.literal(1)]) })
    .safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    await ownerOf(parsed.data.businessId);
    await moveBankAccount(parsed.data.businessId, parsed.data.accountId, parsed.data.direction);
    published(parsed.data.businessId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleBankAccount(input: unknown): Promise<ActionResult> {
  const parsed = idsSchema.extend({ isActive: z.boolean() }).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const ctx = await ownerOf(parsed.data.businessId);
    await setBankAccountActive(
      parsed.data.businessId,
      parsed.data.accountId,
      parsed.data.isActive,
      ctx,
    );
    published(parsed.data.businessId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
