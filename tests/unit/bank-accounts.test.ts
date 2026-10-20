import { describe, expect, it } from "vitest";
import {
  accountsForBranch,
  bankAccountSchema,
  toBankAccountData,
  type BankAccountInput,
} from "@/features/payments/schemas";

const valid: BankAccountInput = {
  businessId: "8f9d0a5e-7f3c-4c5b-9a2e-1d2c3b4a5f6e",
  bank_name: "Banco Industrial",
  account_type: "Monetaria",
  account_number: "000-000000-0",
  holder_name: "Café El Portal, S.A.",
  instructions: "",
  branchId: "all",
  is_active: true,
};

describe("bankAccountSchema", () => {
  it("'Todas las sucursales' se guarda como branch_id null e instrucciones vacías como null", () => {
    expect(toBankAccountData(bankAccountSchema.parse(valid))).toMatchObject({
      branch_id: null,
      instructions: null,
      account_number: "000-000000-0",
    });
  });

  it.each(["000-000000-0", "3012345678", "301 234 5678"])("acepta el número %s", (n) => {
    expect(bankAccountSchema.safeParse({ ...valid, account_number: n }).success).toBe(true);
  });

  it.each(["abc", "12", "-000-000", "0000-"])("rechaza el número %s", (n) => {
    expect(bankAccountSchema.safeParse({ ...valid, account_number: n }).success).toBe(false);
  });

  it("exige banco, titular y tipo válido", () => {
    expect(bankAccountSchema.safeParse({ ...valid, bank_name: "" }).success).toBe(false);
    expect(bankAccountSchema.safeParse({ ...valid, holder_name: "AB" }).success).toBe(false);
    expect(bankAccountSchema.safeParse({ ...valid, account_type: "Corriente" }).success).toBe(
      false,
    );
  });
});

describe("accountsForBranch", () => {
  const rows = [
    { id: "a", branch_id: null, is_active: true, sort: 1 },
    { id: "b", branch_id: "antigua", is_active: true, sort: 0 },
    { id: "c", branch_id: "zona1", is_active: true, sort: 2 },
    { id: "d", branch_id: null, is_active: false, sort: 3 },
  ];

  it("muestra las generales y las de esa sucursal, activas y en orden", () => {
    expect(accountsForBranch(rows, "antigua").map((a) => a.id)).toEqual(["b", "a"]);
    expect(accountsForBranch(rows, "zona1").map((a) => a.id)).toEqual(["a", "c"]);
  });
});
