import type { Coords } from "@/features/location/lib/coords";
import { toE164 } from "@/lib/phone";
import { locationProblem, type DeliveryLocation } from "./delivery";
import { formatQ } from "@/lib/money";

/**
 * Hoja de pedido (pura): qué tipos de pedido y pagos ofrece la sucursal,
 * totales con envío y mínimo a domicilio, la mesa del QR y la validación de
 * los datos del comensal. El servidor repite la validación (QRM-027).
 */

export type OrderType = "dine_in" | "takeout" | "delivery";
export type PayMethod = "cash" | "card_on_site" | "transfer";

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dine_in: "Comer aquí",
  takeout: "Para llevar",
  delivery: "A domicilio",
};
export const PAY_METHOD_LABELS: Record<PayMethod, string> = {
  cash: "Efectivo",
  card_on_site: "Tarjeta",
  transfer: "Transferencia",
};

export const MAX_NAME = 60;
export const MAX_ORDER_NOTE = 280;
export const MAX_ADDRESS = 160;
export const MAX_TABLE = 20;

export type CheckoutBranch = {
  acceptsDineIn: boolean;
  acceptsTakeout: boolean;
  acceptsDelivery: boolean;
  acceptsTransfer: boolean;
  deliveryFeeCents: number;
  minOrderCents: number;
  /** Hay cuentas para transferencia (del negocio o de esta sucursal). */
  hasBankAccounts: boolean;
  /** A domicilio exige el pin (GPS o mapa); si no, basta la dirección escrita. */
  requiresLocation: boolean;
  /** Dónde está la sucursal (para medir la cobertura). */
  location: Coords | null;
  /** Radio de entrega en km (null = sin límite). */
  radiusKm: number | null;
};

export function orderTypes(branch: CheckoutBranch): OrderType[] {
  return (
    [
      ["dine_in", branch.acceptsDineIn],
      ["takeout", branch.acceptsTakeout],
      ["delivery", branch.acceptsDelivery],
    ] as const
  )
    .filter(([, ok]) => ok)
    .map(([type]) => type);
}

/** Transferencia solo si la sucursal la acepta y hay cuentas que mostrar. */
export function payMethods(branch: CheckoutBranch): PayMethod[] {
  return branch.acceptsTransfer && branch.hasBankAccounts
    ? ["cash", "card_on_site", "transfer"]
    : ["cash", "card_on_site"];
}

/** Tipo con el que abre la hoja: el último que usó, "Comer aquí" si llegó por el QR de una mesa. */
export function defaultOrderType(
  types: readonly OrderType[],
  hints: { table: string | null; last: OrderType | null },
): OrderType | null {
  if (hints.table && types.includes("dine_in")) return "dine_in";
  if (hints.last && types.includes(hints.last)) return hints.last;
  return types[0] ?? null;
}

export function orderTotals(subtotalCents: number, type: OrderType | null, branch: CheckoutBranch) {
  const delivery = type === "delivery";
  const deliveryFeeCents = delivery ? branch.deliveryFeeCents : 0;
  const missingCents = delivery ? Math.max(0, branch.minOrderCents - subtotalCents) : 0;
  return {
    subtotalCents,
    deliveryFeeCents,
    totalCents: subtotalCents + deliveryFeeCents,
    /** Cuánto falta para el mínimo a domicilio (0 = alcanza). */
    missingCents,
  };
}

/** "?mesa=4" → "Mesa 4"; "?mesa=Terraza 2" → "Terraza 2". Solo texto simple y corto. */
export function tableFromParam(value: string | null | undefined): string | null {
  const clean = (value ?? "")
    .replace(/[^\p{L}\p{N} #-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TABLE);
  if (!clean) return null;
  return /^\d+$/.test(clean) ? `Mesa ${clean}` : clean;
}

export type CheckoutInput = {
  orderType: OrderType | null;
  table: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  addressReference: string;
  /** Pin de la entrega a domicilio (QRM-026). */
  location: DeliveryLocation | null;
  /** null = lo antes posible; si no, el instante ISO elegido. */
  scheduledFor: string | null;
  payment: PayMethod | null;
  note: string;
};

export type CheckoutField = keyof CheckoutInput | "total";
export type CheckoutProblems = Partial<Record<CheckoutField, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Problemas por campo (vacío = listo para pedir). */
export function checkoutProblems(
  input: CheckoutInput,
  ctx: {
    branch: CheckoutBranch;
    subtotalCents: number;
    /** Del cálculo de ¿Para cuándo?: se puede pedir ya y horarios válidos. */
    asap: boolean;
    validTimes: readonly string[];
  },
): CheckoutProblems {
  const p: CheckoutProblems = {};
  const types = orderTypes(ctx.branch);
  if (!input.orderType || !types.includes(input.orderType)) p.orderType = "Elige cómo lo quieres.";

  const name = input.name.trim();
  if (name.length < 2) p.name = "Escribe tu nombre.";
  else if (name.length > MAX_NAME) p.name = `Máximo ${MAX_NAME} caracteres.`;

  const phone = input.phone.trim();
  if (phone && !toE164(phone)) p.phone = "Revisa el número (8 dígitos).";
  else if (!phone && input.orderType === "delivery")
    p.phone = "Déjanos un teléfono por si el repartidor no te encuentra.";

  const email = input.email.trim();
  if (email && !EMAIL.test(email)) p.email = "Revisa el correo.";

  if (input.orderType === "delivery") {
    const address = input.address.trim();
    if (address.length < 5) p.address = "Escribe tu dirección.";
    else if (address.length > MAX_ADDRESS) p.address = `Máximo ${MAX_ADDRESS} caracteres.`;
    // En Guatemala la referencia es lo que de verdad ubica al repartidor.
    const reference = input.addressReference.trim();
    if (reference.length < 3) p.addressReference = "Escribe un punto de referencia.";
    else if (reference.length > MAX_ADDRESS)
      p.addressReference = `Máximo ${MAX_ADDRESS} caracteres.`;
    const where = locationProblem(input.location, ctx.branch);
    if (where) p.location = where;
    const totals = orderTotals(ctx.subtotalCents, "delivery", ctx.branch);
    if (totals.missingCents > 0)
      p.total = `Te faltan ${formatQ(totals.missingCents)} para el pedido a domicilio mínimo.`;
  }
  if (input.table.trim().length > MAX_TABLE) p.table = `Máximo ${MAX_TABLE} caracteres.`;

  if (input.scheduledFor === null) {
    if (!ctx.asap) p.scheduledFor = "Elige para cuándo lo quieres.";
  } else if (!ctx.validTimes.includes(input.scheduledFor)) {
    p.scheduledFor = "Ese horario ya no está disponible. Elige otro.";
  }

  if (!input.payment || !payMethods(ctx.branch).includes(input.payment))
    p.payment = "Elige cómo vas a pagar.";
  if (input.note.trim().length > MAX_ORDER_NOTE) p.note = `Máximo ${MAX_ORDER_NOTE} caracteres.`;
  if (ctx.subtotalCents <= 0) p.total = "Agrega al menos un producto.";
  return p;
}

/** Orden de los campos en la hoja: para llevar el foco al primer problema. */
export const CHECKOUT_FIELD_ORDER: CheckoutField[] = [
  "total",
  "orderType",
  "table",
  "location",
  "address",
  "addressReference",
  "scheduledFor",
  "name",
  "phone",
  "email",
  "payment",
  "note",
];
