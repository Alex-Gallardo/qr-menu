import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bankAccountSchema, type BankAccountInput } from "@/features/payments/schemas";
import {
  createBankAccount,
  deleteBankAccount,
  listBankAccounts,
  moveBankAccount,
  restoreBankAccount,
  setBankAccountActive,
} from "@/features/payments/server";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/** QRM-012c: cuentas generales o por sucursal, orden, ocultar y deshacer un borrado. */

const SLUG = "zz-test-qrm012c";
let businessId: string;
let branchId: string;
let foreignBranchId: string;
let actorId: string;

const input = (over: Partial<BankAccountInput>) =>
  bankAccountSchema.parse({
    businessId,
    bank_name: "Banco Industrial",
    account_type: "Monetaria",
    account_number: "000-123456-7",
    holder_name: "Prueba S.A.",
    instructions: "",
    branchId: "all",
    is_active: true,
    ...over,
  });

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba QRM-012c",
      branches: { create: { slug: "centro", name: "Centro", whatsapp_e164: "+50255550000" } },
    },
    select: { id: true, branches: { select: { id: true } } },
  });
  businessId = biz.id;
  branchId = biz.branches[0]!.id;
  const demo = await db().branches.findFirst({ where: { business: { slug: "cafe-el-portal" } } });
  const owner = await db().business_members.findFirst({ where: { role: "owner" } });
  if (!demo || !owner) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  foreignBranchId = demo.id;
  actorId = owner.user_id;
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().$disconnect();
});

describe("cuentas para transferencia", () => {
  it("crea una cuenta general y otra solo de una sucursal, en orden", async () => {
    await createBankAccount(input({ bank_name: "Banco Industrial" }), { actorId });
    await createBankAccount(input({ bank_name: "Banrural", branchId, account_type: "Ahorro" }), {
      actorId,
    });
    const list = await listBankAccounts(businessId);
    expect(list.map((a) => [a.bank_name, a.branch_id, a.sort])).toEqual([
      ["Banco Industrial", null, 0],
      ["Banrural", branchId, 1],
    ]);
  });

  it("no acepta una sucursal de otro negocio", async () => {
    const error = await createBankAccount(input({ branchId: foreignBranchId }), { actorId }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("branch_forbidden");
  });

  it("cambia el orden", async () => {
    const [first] = await listBankAccounts(businessId);
    await moveBankAccount(businessId, first!.id, 1);
    expect((await listBankAccounts(businessId)).map((a) => a.bank_name)).toEqual([
      "Banrural",
      "Banco Industrial",
    ]);
  });

  it("oculta y vuelve a mostrar", async () => {
    const [account] = await listBankAccounts(businessId);
    await setBankAccountActive(businessId, account!.id, false, { actorId });
    expect((await listBankAccounts(businessId))[0]!.is_active).toBe(false);
    await setBankAccountActive(businessId, account!.id, true, { actorId });
  });

  it("borra y deshace con el mismo id y orden", async () => {
    const [account] = await listBankAccounts(businessId);
    const removed = await deleteBankAccount(businessId, account!.id, { actorId });
    expect(await listBankAccounts(businessId)).toHaveLength(1);
    await restoreBankAccount(businessId, removed, { actorId });
    const after = await listBankAccounts(businessId);
    expect(after.map((a) => a.id)).toEqual([account!.id, after[1]!.id]);
  });

  it("la auditoría nunca guarda el número completo de la cuenta", async () => {
    const logs = await db().audit_logs.findMany({ where: { business_id: businessId } });
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs.map((l) => l.diff))).not.toContain("123456");
  });
});
