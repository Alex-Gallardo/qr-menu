import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Usuarios de prueba (solo desarrollo). Las credenciales vienen de .env.local;
 * si no existe SEED_USERS_PASSWORD se genera una y se guarda ahí (ignorado por git).
 */

export const SEED_USERS = {
  admin: { envEmail: "SEED_ADMIN_EMAIL", fallback: "admin@qrmenu.test", name: "Admin Plataforma" },
  owner: { envEmail: "SEED_OWNER_EMAIL", fallback: "duenio@qrmenu.test", name: "Dueño Demo" },
  manager: {
    envEmail: "SEED_MANAGER_EMAIL",
    fallback: "encargado@qrmenu.test",
    name: "Encargado Antigua",
  },
} as const;

export type SeedUserKey = keyof typeof SEED_USERS;

export function seedPassword(): string {
  const existing = process.env.SEED_USERS_PASSWORD;
  if (existing) return existing;

  const generated = randomBytes(18).toString("base64url");
  const file = ".env.local";
  const prefix = existsSync(file) && !readFileSync(file, "utf8").endsWith("\n") ? "\n" : "";
  appendFileSync(
    file,
    `${prefix}\n# Contraseña de los usuarios de prueba del seed (solo dev)\nSEED_USERS_PASSWORD=${generated}\n`,
  );
  process.env.SEED_USERS_PASSWORD = generated;
  console.log("  · Contraseña de usuarios de prueba generada y guardada en .env.local");
  return generated;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Crea el usuario en Supabase Auth si no existe y devuelve su id (el trigger crea su profile). */
export async function ensureAuthUser(key: SeedUserKey, password: string) {
  const def = SEED_USERS[key];
  const email = process.env[def.envEmail] ?? def.fallback;
  const supabase = adminClient();

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: def.name },
  });
  if (created.data.user) return { id: created.data.user.id, email };

  if (created.error?.code !== "email_exists") {
    throw new Error(`No se pudo crear ${email}: ${created.error?.message}`);
  }

  // Ya existe: se busca y se le restablece la contraseña del seed.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) {
      await supabase.auth.admin.updateUserById(user.id, { password });
      return { id: user.id, email };
    }
    if (data.users.length < 200) break;
  }
  throw new Error(`No se encontró el usuario existente ${email}.`);
}
