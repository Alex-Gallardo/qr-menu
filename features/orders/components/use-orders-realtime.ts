"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type RealtimeState = "connecting" | "live" | "offline";

/** Fila de orders tal como la manda Realtime (columnas de la tabla). */
export type OrderRow = {
  id: string;
  number: number;
  status: string;
  branch_id: string;
  total_cents: number;
  customer_name: string;
  order_type: string;
  table_label: string | null;
  scheduled_for: string | null;
  payment_method: string;
  address: string | null;
  created_at: string;
};

/**
 * Pedidos en tiempo real (Supabase Realtime). La sesión del usuario viaja con
 * la suscripción, así que RLS (can_see_branch) decide qué llega: un encargado
 * de Antigua nunca recibe los pedidos de Zona 1.
 */
export function useOrdersRealtime({
  businessId,
  branchIds,
  onInsert,
  onUpdate,
}: {
  businessId: string;
  /** Una sola sucursal → filtro por sucursal; varias → por negocio (RLS hace el resto). */
  branchIds: string[];
  onInsert: (row: OrderRow) => void;
  onUpdate: (row: OrderRow) => void;
}) {
  const [state, setState] = useState<RealtimeState>("connecting");
  // Los callbacks cambian en cada render; la suscripción no.
  const handlers = useRef({ onInsert, onUpdate });
  useEffect(() => {
    handlers.current = { onInsert, onUpdate };
  });
  const key = branchIds.join(",");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const ids = key.split(",").filter(Boolean);
    const filter = ids.length === 1 ? `branch_id=eq.${ids[0]}` : `business_id=eq.${businessId}`;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      // Con el token del usuario (no la llave anónima) para que aplique RLS.
      const { data } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (cancelled) return;
      channel = supabase
        .channel(`pedidos:${businessId}:${key}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders", filter },
          (payload) => {
            const row = payload.new as OrderRow;
            if (ids.includes(row.branch_id)) handlers.current.onInsert(row);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter },
          (payload) => {
            const row = payload.new as OrderRow;
            if (ids.includes(row.branch_id)) handlers.current.onUpdate(row);
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          setState(
            status === "SUBSCRIBED" ? "live" : status === "CLOSED" ? "offline" : "connecting",
          );
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [businessId, key]);

  return state;
}
