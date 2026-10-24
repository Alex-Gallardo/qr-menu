import "server-only";
import { notFound } from "next/navigation";
import { getAuthUser, getProfile, requirePlatformUser } from "@/lib/auth/session";
import { AccessError } from "@/lib/errors";
import { can, type Permission } from "./permissions";

/** Páginas del super admin: equipo con 2FA y el permiso (sin él, 404). */
export async function requirePlatform(permission: Permission, next = "/admin") {
  const { user, profile } = await requirePlatformUser(next);
  if (!can(profile.platform_role, permission)) notFound();
  return { user, profile };
}

/** Acciones del super admin: lanza AccessError (mensaje para el usuario) si no puede. */
export async function requirePlatformAction(permission: Permission) {
  const user = await getAuthUser();
  if (!user || user.isAnonymous)
    throw new AccessError("unauthenticated", "Tu sesión terminó. Vuelve a entrar.");
  if (user.aal !== "aal2")
    throw new AccessError("forbidden", "Confirma tu código de dos pasos para seguir.");
  const profile = await getProfile(user.id);
  if (!profile || !can(profile.platform_role, permission))
    throw new AccessError("role_forbidden", "Tu rol en la plataforma no permite esta acción.");
  return { user, profile };
}
