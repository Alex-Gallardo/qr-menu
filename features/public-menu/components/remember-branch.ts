/**
 * Recuerda en el celular la última sucursal elegida de cada negocio (solo para
 * destacarla en el selector). Si el navegador no deja guardar, no pasa nada.
 */
const key = (businessSlug: string) => `qrm:sucursal:${businessSlug}`;

export function rememberBranch(businessSlug: string, branchSlug: string) {
  try {
    localStorage.setItem(key(businessSlug), branchSlug);
  } catch {
    // Modo privado o almacenamiento bloqueado.
  }
}

export function rememberedBranch(businessSlug: string): string | null {
  try {
    return localStorage.getItem(key(businessSlug));
  } catch {
    return null;
  }
}
