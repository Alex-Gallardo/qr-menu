import { PanelDemo } from "./panel-demo";
import { Section } from "./section";

export function PanelSection() {
  return (
    <Section
      id="panel"
      number={12}
      title="Panel"
      description="Barra lateral y pestañas, selector de sucursal, tarjeta de pedido por estado, entrega con mapa, catálogo con disponibilidad por sucursal, programación semanal, KPIs y límite del plan. Datos de ejemplo: nada se guarda."
    >
      <PanelDemo />
    </Section>
  );
}
