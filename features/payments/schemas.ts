import { z } from "zod";

/** Bancos más comunes en Guatemala (sugerencias; se puede escribir otro). */
export const GT_BANKS = [
  "Banco Industrial",
  "Banrural",
  "BAM",
  "G&T Continental",
  "BAC Credomatic",
  "Bantrab",
  "Banco Promerica",
  "Interbanco",
  "Ficohsa",
  "Crédito Hipotecario Nacional (CHN)",
  "Banco Inmobiliario",
  "Vivibanco",
  "Banco Azteca",
] as const;

export const ACCOUNT_TYPES = ["Monetaria", "Ahorro"] as const;

/** "all" = la cuenta se muestra en todas las sucursales. */
export const ALL_BRANCHES = "all";

export const bankAccountSchema = z.object({
  businessId: z.uuid(),
  accountId: z.uuid().optional(),
  bank_name: z
    .string()
    .trim()
    .min(2, "Escribe el banco.")
    .max(60, "Usa como máximo 60 caracteres."),
  account_type: z.enum(ACCOUNT_TYPES, { message: "Elige monetaria o ahorro." }),
  account_number: z
    .string()
    .trim()
    .regex(/^[0-9][0-9 -]{4,28}[0-9]$/, "Usa solo números y guiones, como 000-000000-0."),
  holder_name: z.string().trim().min(3, "Escribe a nombre de quién está la cuenta.").max(80),
  instructions: z
    .string()
    .trim()
    .max(200, "Usa como máximo 200 caracteres.")
    .transform((v) => v || null),
  branchId: z.union([z.uuid(), z.literal(ALL_BRANCHES)]),
  is_active: z.boolean(),
});

export type BankAccountInput = z.input<typeof bankAccountSchema>;
export type BankAccountOutput = z.output<typeof bankAccountSchema>;

/** Datos que se guardan (branch_id null = todas las sucursales). */
export function toBankAccountData(v: BankAccountOutput) {
  return {
    bank_name: v.bank_name,
    account_type: v.account_type,
    account_number: v.account_number.replace(/\s+/g, " "),
    holder_name: v.holder_name,
    instructions: v.instructions,
    branch_id: v.branchId === ALL_BRANCHES ? null : v.branchId,
    is_active: v.is_active,
  };
}

/** Cuentas que ve el cliente de una sucursal: activas, generales o de esa sucursal, en orden. */
export function accountsForBranch<
  T extends { branch_id: string | null; is_active: boolean; sort: number },
>(accounts: T[], branchId: string) {
  return accounts
    .filter((a) => a.is_active && (a.branch_id === null || a.branch_id === branchId))
    .sort((a, b) => a.sort - b.sort);
}
