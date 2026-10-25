import { z } from "@/lib/zod";

/**
 * Variables públicas (disponibles en el navegador). Next.js solo las incrusta
 * si se leen de forma literal, por eso se listan una por una.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cached: ClientEnv | undefined;

export function clientEnv(): ClientEnv {
  cached ??= clientEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return cached;
}
