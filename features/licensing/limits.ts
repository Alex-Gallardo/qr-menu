import { PLAN_CATALOG, type LimitedResource, type PlanLimits } from "./plan-catalog";

/** Nombres para los mensajes (singular, plural). */
const RESOURCE_NAMES: Record<LimitedResource, [string, string]> = {
  branches: ["sucursal", "sucursales"],
  products: ["producto", "productos"],
  menus: ["menú", "menús"],
  time_slots: ["franja horaria", "franjas horarias"],
  qr: ["código QR", "códigos QR"],
  managers: ["encargado", "encargados"],
  staff: ["persona de staff", "personas de staff"],
  storage_mb: ["MB de almacenamiento", "MB de almacenamiento"],
};

export type LimitCheck =
  | { ok: true; limit: number | null; used: number }
  | { ok: false; limit: number; used: number; message: string };

/** El plan público más barato que permitiría llegar a `needed`. */
export function upgradeTarget(resource: LimitedResource, needed: number) {
  return PLAN_CATALOG.find((p) => {
    const limit = p.limits[resource];
    return limit === null || limit >= needed;
  });
}

export function limitMessage(resource: LimitedResource, limit: number, needed: number) {
  const [one, many] = RESOURCE_NAMES[resource];
  const included =
    limit === 0
      ? `Tu plan no incluye ${many}`
      : `Tu plan incluye ${limit} ${limit === 1 ? one : many}`;
  const target = upgradeTarget(resource, needed);
  return target
    ? `${included}. Pasa a ${target.name} para agregar más.`
    : `${included}. Escríbenos para ampliarlo.`;
}

/** ¿Cabe agregar `adding` unidades con `used` ya ocupadas? */
export function checkLimit(
  limits: PlanLimits,
  resource: LimitedResource,
  used: number,
  adding = 1,
): LimitCheck {
  const limit = limits[resource];
  if (limit === null || used + adding <= limit) return { ok: true, limit, used };
  return { ok: false, limit, used, message: limitMessage(resource, limit, used + adding) };
}
