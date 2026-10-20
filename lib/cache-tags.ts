/**
 * Tags de caché del menú público. Toda Server Action que cambie algo visible
 * llama updateTag(tags.business(id)) o updateTag(tags.branch(id)): el cambio se
 * publica de inmediato (meta de la guía: menos de 5 s).
 */
export const tags = {
  business: (id: string) => `business:${id}`,
  branch: (id: string) => `branch:${id}`,
  /** Resolución de link → negocio (cambia al editar el link). */
  slug: (slug: string) => `slug:${slug}`,
};
