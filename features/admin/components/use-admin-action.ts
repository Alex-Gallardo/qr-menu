"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { runAction } from "@/lib/action-client";
import type { ActionResult } from "@/lib/action-result";

/** Ejecuta una acción del admin con aviso y refresco (todas quedan en auditoría). */
export function useAdminAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const res = await runAction(action);
      if (!res.ok) return void toast.error(res.message);
      if (res.message) toast.success(res.message);
      onOk?.();
      router.refresh();
    });
  return { pending, run };
}
