import "server-only";
import { audit, diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { toBankAccountData, type BankAccountOutput } from "./schemas";

const SELECT = {
  id: true,
  bank_name: true,
  account_type: true,
  account_number: true,
  holder_name: true,
  instructions: true,
  branch_id: true,
  is_active: true,
  sort: true,
} as const;

export type BankAccountRow = Awaited<ReturnType<typeof listBankAccounts>>[number];

export async function listBankAccounts(businessId: string) {
  return db().bank_accounts.findMany({
    where: { business_id: businessId },
    orderBy: [{ sort: "asc" }, { id: "asc" }],
    select: SELECT,
  });
}

/** La sucursal elegida debe ser del mismo negocio. */
async function assertBranchOfBusiness(businessId: string, branchId: string | null) {
  if (!branchId) return;
  const branch = await db().branches.findFirst({
    where: { id: branchId, business_id: businessId },
    select: { id: true },
  });
  if (!branch) throw new AppError("branch_forbidden", "Esa sucursal no es de tu negocio.");
}

async function getAccount(businessId: string, accountId: string) {
  const account = await db().bank_accounts.findFirst({
    where: { id: accountId, business_id: businessId },
    select: SELECT,
  });
  if (!account) throw new AppError("not_found", "No encontramos esa cuenta.");
  return account;
}

type Ctx = { actorId: string };

export async function createBankAccount(input: BankAccountOutput, ctx: Ctx) {
  const data = toBankAccountData(input);
  await assertBranchOfBusiness(input.businessId, data.branch_id);
  const count = await db().bank_accounts.count({ where: { business_id: input.businessId } });
  const account = await db().bank_accounts.create({
    data: { ...data, business_id: input.businessId, sort: count },
    select: SELECT,
  });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId: input.businessId,
    action: "bank_account.create",
    entity: "bank_accounts",
    entityId: account.id,
    // Nunca el número completo en la auditoría: solo los últimos 4 dígitos.
    diff: { bank_name: data.bank_name, account_number: `…${data.account_number.slice(-4)}` },
  });
  return account;
}

export async function updateBankAccount(
  input: BankAccountOutput & { accountId: string },
  ctx: Ctx,
) {
  const before = await getAccount(input.businessId, input.accountId);
  const data = toBankAccountData(input);
  await assertBranchOfBusiness(input.businessId, data.branch_id);
  await db().bank_accounts.update({ where: { id: input.accountId }, data });

  const changes = diffFields(
    { ...before, account_number: `…${before.account_number.slice(-4)}` },
    { ...data, account_number: `…${data.account_number.slice(-4)}` },
  );
  if (Object.keys(changes).length > 0) {
    await audit({
      actorId: ctx.actorId,
      actorKind: "user",
      businessId: input.businessId,
      action: "bank_account.update",
      entity: "bank_accounts",
      entityId: input.accountId,
      diff: changes,
    });
  }
}

/** Borra y devuelve la fila completa para poder deshacer. */
export async function deleteBankAccount(businessId: string, accountId: string, ctx: Ctx) {
  const account = await getAccount(businessId, accountId);
  await db().bank_accounts.delete({ where: { id: accountId } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "bank_account.delete",
    entity: "bank_accounts",
    entityId: accountId,
    diff: { bank_name: account.bank_name, account_number: `…${account.account_number.slice(-4)}` },
  });
  return account;
}

/** "Deshacer": vuelve a crear la cuenta con el mismo id y orden. */
export async function restoreBankAccount(businessId: string, account: BankAccountRow, ctx: Ctx) {
  await assertBranchOfBusiness(businessId, account.branch_id);
  await db().bank_accounts.create({ data: { ...account, business_id: businessId } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "bank_account.restore",
    entity: "bank_accounts",
    entityId: account.id,
  });
}

/** Mueve la cuenta un lugar arriba o abajo (intercambia el orden con su vecina). */
export async function moveBankAccount(businessId: string, accountId: string, direction: -1 | 1) {
  const accounts = await listBankAccounts(businessId);
  const index = accounts.findIndex((a) => a.id === accountId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= accounts.length) return;
  const ordered = [...accounts];
  [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
  await db().$transaction(
    ordered.map((a, sort) => db().bank_accounts.update({ where: { id: a.id }, data: { sort } })),
  );
}

export async function setBankAccountActive(
  businessId: string,
  accountId: string,
  isActive: boolean,
  ctx: Ctx,
) {
  const before = await getAccount(businessId, accountId);
  if (before.is_active === isActive) return;
  await db().bank_accounts.update({ where: { id: accountId }, data: { is_active: isActive } });
  await audit({
    actorId: ctx.actorId,
    actorKind: "user",
    businessId,
    action: "bank_account.update",
    entity: "bank_accounts",
    entityId: accountId,
    diff: { is_active: [before.is_active, isActive] },
  });
}
