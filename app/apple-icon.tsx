import { appIcon } from "@/features/notifications/app-icon";

/** Ícono de "Agregar a inicio" en iPhone (180 px, sin transparencia). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180, 0.72);
}
