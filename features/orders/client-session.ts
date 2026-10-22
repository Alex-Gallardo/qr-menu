"use client";

const KEY = "qrm:sesion";

/**
 * Id aleatorio de este dispositivo (sin datos personales) para el límite de
 * pedidos por sesión. Si no hay almacenamiento, uno nuevo por visita.
 */
export function clientSessionId() {
  const fresh = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && /^[\w-]{8,64}$/.test(saved)) return saved;
    const id = fresh();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return fresh();
  }
}
