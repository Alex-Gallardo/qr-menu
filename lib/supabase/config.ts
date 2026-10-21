/**
 * Configuración pública de Supabase. Las NEXT_PUBLIC_* se leen de forma literal
 * para que Next las incruste en el build; si faltan (p. ej. un entorno de Vercel
 * sin configurar), devuelve null y quien llama decide cómo seguir sin romper.
 */
export function supabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export const isSupabaseConfigured = () => supabasePublicConfig() !== null;
