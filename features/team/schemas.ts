import { z } from "zod";
import { isValidPin } from "@/features/staff/pin";

const branchAccess = {
  allBranches: z.boolean(),
  branchIds: z.array(z.uuid()).max(100),
};
const needsBranch = (v: { allBranches: boolean; branchIds: string[] }) =>
  v.allBranches || v.branchIds.length > 0;
const NEEDS_BRANCH = { message: "Elige al menos una sucursal.", path: ["branchIds"] };

/** Invitar encargado (solo el dueño). */
export const inviteSchema = z
  .object({
    businessId: z.uuid(),
    email: z.string().trim().toLowerCase().pipe(z.email("Ese correo no parece válido.")),
    ...branchAccess,
  })
  .refine(needsBranch, NEEDS_BRANCH);

/** Cambiar las sucursales de un encargado. */
export const memberBranchesSchema = z
  .object({ businessId: z.uuid(), memberId: z.uuid(), ...branchAccess })
  .refine(needsBranch, NEEDS_BRANCH);

export const memberIdSchema = z.object({ businessId: z.uuid(), memberId: z.uuid() });
export const invitationIdSchema = z.object({ businessId: z.uuid(), invitationId: z.uuid() });
export const acceptInviteSchema = z.object({ token: z.string().regex(/^[\w-]{20,100}$/) });

const pin = z.string().refine(isValidPin, "El PIN tiene de 4 a 6 dígitos.");

/** Alta de staff con PIN en una sucursal. */
export const staffCreateSchema = z.object({
  businessId: z.uuid(),
  branchId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(2, "Escribe el nombre (ej. Rosa - caja).")
    .max(40, "Usa como máximo 40 caracteres."),
  pin,
});

export const staffPinSchema = z.object({ businessId: z.uuid(), staffId: z.uuid(), pin });
export const staffActiveSchema = z.object({
  businessId: z.uuid(),
  staffId: z.uuid(),
  active: z.boolean(),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
