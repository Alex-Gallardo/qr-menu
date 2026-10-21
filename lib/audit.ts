import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/** Registro de auditoría: quién cambió qué. Nunca guardar secretos ni PINs. */
export async function audit(entry: {
  actorId: string | null;
  actorKind: "user" | "staff" | "platform" | "system";
  businessId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: Prisma.InputJsonValue;
}) {
  await db().audit_logs.create({
    data: {
      actor_id: entry.actorId,
      actor_kind: entry.actorKind,
      business_id: entry.businessId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      diff: entry.diff,
    },
  });
}

/** Solo los campos que cambiaron: { campo: [antes, después] }, serializable a JSON. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Prisma.InputJsonObject {
  const out: Record<string, [unknown, unknown]> = {};
  for (const [key, value] of Object.entries(after)) {
    if (value !== undefined && before[key] !== value) out[key] = [before[key] ?? null, value];
  }
  return JSON.parse(JSON.stringify(out)) as Prisma.InputJsonObject;
}
