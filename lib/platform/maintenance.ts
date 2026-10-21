/**
 * Modo mantenimiento (platform_settings.maintenance_mode), leído por el proxy en
 * cada petición. Se consulta por la API REST de Supabase con la llave de servicio
 * (la tabla tiene RLS cerrado) y se guarda en memoria 30 s para no ir a la base
 * en cada request. Si la consulta falla, la app sigue funcionando (fail-open).
 */

export type MaintenanceState = { enabled: boolean; message: string };

const TTL_MS = 30_000;
const OFF: MaintenanceState = { enabled: false, message: "" };

let cached: { value: MaintenanceState; at: number } | undefined;

export function parseMaintenance(value: unknown): MaintenanceState {
  if (!value || typeof value !== "object") return OFF;
  const v = value as { enabled?: unknown; message?: unknown };
  return {
    enabled: v.enabled === true,
    message: typeof v.message === "string" ? v.message : "",
  };
}

export async function getMaintenance(): Promise<MaintenanceState> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return OFF;

  try {
    const res = await fetch(
      `${url}/rest/v1/platform_settings?key=eq.maintenance_mode&select=value`,
      { headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(2000) },
    );
    if (!res.ok) return cached?.value ?? OFF;
    const rows = (await res.json()) as { value: unknown }[];
    const value = parseMaintenance(rows[0]?.value);
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return cached?.value ?? OFF;
  }
}
