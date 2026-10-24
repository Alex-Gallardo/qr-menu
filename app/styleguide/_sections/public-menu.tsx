import { PublicMenuDemo } from "./public-menu-demo";
import { PublicMenuExtras } from "./public-menu-extras";
import { Section } from "./section";

export function PublicMenuSection() {
  return (
    <Section
      id="publico"
      number={11}
      title="Menú público"
      description="Selector de sucursal, encabezado, chips de franja, pestañas con scroll-spy, tarjetas de las 4 plantillas, hoja de producto, carrito, hoja de pedido (con mapa y cuentas para transferencia), confirmación y estrellas. Son los mismos componentes que ve el cliente en /{negocio}/{sucursal}."
    >
      <PublicMenuDemo />
      <PublicMenuExtras />
    </Section>
  );
}
