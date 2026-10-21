import { PublicMenuDemo } from "./public-menu-demo";
import { Section } from "./section";

export function PublicMenuSection() {
  return (
    <Section
      id="publico"
      number={11}
      title="Menú público · Clásico"
      description="Encabezado, chips de franja, pestañas de secciones con scroll-spy, tarjetas y avisos de la plantilla Clásico, con cualquiera de las 8 paletas. Son los mismos componentes que ve el cliente en /{negocio}/{sucursal}."
    >
      <PublicMenuDemo />
    </Section>
  );
}
