import { Section } from "./section";
import { SplashDemo } from "./splash-demo";

export function SplashSection() {
  return (
    <Section
      id="bienvenida"
      number={9}
      title="Bienvenida (splash)"
      description="Panel con el fondo y el logo del negocio que se levanta y revela el menú, que ya cargó debajo. 4 estilos × 3 curvas, fondo de color, degradado o imagen y 3 tamaños de logo. Cambiar cualquier opción la vuelve a reproducir."
    >
      <SplashDemo />
    </Section>
  );
}
