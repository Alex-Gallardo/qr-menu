import { centsToInput } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { defaultWeek, toWeek } from "./hours";
import type { BranchFormInput } from "./schemas";

type StoredBranch = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  address_reference: string | null;
  city: string | null;
  whatsapp_e164: string;
  phone: string | null;
  google_place_id: string | null;
  accepts_dine_in: boolean;
  accepts_takeout: boolean;
  accepts_delivery: boolean;
  accepts_transfer: boolean;
  delivery_fee_cents: number;
  delivery_radius_km: number | null;
  min_order_cents: number;
  delivery_requires_location: boolean;
  preorder_mode: "off" | "next_open" | "always";
  preorder_min_lead_min: number;
  preorder_max_days: number;
  is_active: boolean;
  hours: { weekday: number; opens: string; closes: string }[];
};

/** Sucursal guardada → valores del formulario (o valores por defecto para una nueva). */
export function toBranchFormInput(
  businessId: string,
  branch: StoredBranch | null,
  defaults: { city?: string | null; canPreorder: boolean },
): BranchFormInput {
  if (!branch) {
    return {
      businessId,
      name: "",
      slug: "",
      address: "",
      address_reference: "",
      city: defaults.city ?? "",
      whatsapp: "",
      phone: "",
      google_place_id: "",
      accepts_dine_in: true,
      accepts_takeout: true,
      accepts_delivery: false,
      accepts_transfer: true,
      delivery_fee: "0",
      delivery_radius_km: "",
      min_order: "0",
      delivery_requires_location: true,
      preorder_mode: defaults.canPreorder ? "next_open" : "off",
      preorder_min_lead_min: 30,
      preorder_max_days: 2,
      is_active: true,
      hours: defaultWeek(),
    };
  }
  return {
    businessId,
    branchId: branch.id,
    name: branch.name,
    slug: branch.slug,
    address: branch.address ?? "",
    address_reference: branch.address_reference ?? "",
    city: branch.city ?? "",
    whatsapp: formatPhone(branch.whatsapp_e164),
    phone: formatPhone(branch.phone),
    google_place_id: branch.google_place_id ?? "",
    accepts_dine_in: branch.accepts_dine_in,
    accepts_takeout: branch.accepts_takeout,
    accepts_delivery: branch.accepts_delivery,
    accepts_transfer: branch.accepts_transfer,
    delivery_fee: centsToInput(branch.delivery_fee_cents),
    delivery_radius_km: branch.delivery_radius_km === null ? "" : String(branch.delivery_radius_km),
    min_order: centsToInput(branch.min_order_cents),
    delivery_requires_location: branch.delivery_requires_location,
    preorder_mode: branch.preorder_mode,
    preorder_min_lead_min: branch.preorder_min_lead_min,
    preorder_max_days: branch.preorder_max_days,
    is_active: branch.is_active,
    hours: toWeek(branch.hours),
  };
}
