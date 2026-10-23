import type { ComponentType } from "react";
import * as clasico from "./clasico/components";
import * as galeria from "./galeria/components";
import * as minimal from "./minimal/components";
import * as tarjetas from "./tarjetas/components";
import type { MenuSectionProps, ProductCardProps } from "./shared";

/**
 * Las 4 plantillas del menú: cambian la sección y la tarjeta de producto; el
 * encabezado, las pestañas, el carrito y las hojas son los de Clásico.
 */
export type MenuTemplateId = "clasico" | "galeria" | "minimal" | "tarjetas";

export type TemplateParts = {
  MenuSection: ComponentType<MenuSectionProps>;
  ProductCard: ComponentType<ProductCardProps>;
};

export const TEMPLATE_PARTS: Record<MenuTemplateId, TemplateParts> = {
  clasico,
  galeria,
  minimal,
  tarjetas,
};

/**
 * Plantilla con la que se muestra un menú: la guardada si el plan incluye
 * "todas las plantillas"; si no (o si es desconocida), Clásico.
 */
export function templateFor(template: string | null | undefined, allTemplates: boolean) {
  const id = (template ?? "clasico") as MenuTemplateId;
  if (!(id in TEMPLATE_PARTS) || (id !== "clasico" && !allTemplates)) return "clasico";
  return id;
}
