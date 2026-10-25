import { AdminDemo } from "./admin-demo";
import { Section } from "./section";

export function AdminSection() {
  return (
    <Section
      id="super-admin"
      number={13}
      title="Super admin"
      description="Tabla de negocios, barras de uso contra el límite del plan, chips de estado de licencia y tarjeta de pago por verificar."
    >
      <AdminDemo />
    </Section>
  );
}
