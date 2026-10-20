import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env.client";

/** Cliente de Supabase en el navegador: solo para Realtime y Storage (con RLS). */
export function createSupabaseBrowserClient() {
  const env = clientEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
