import { LoadingDemo } from "./loading-demo";
import { Section } from "./section";

export function LoadingSection() {
  return (
    <Section
      id="carga"
      number={10}
      title="Carga"
      description="Ninguna espera sin respuesta visual: skeleton al cargar páginas, modal para acciones que bloquean, spinner en botones e indicador en línea para el guardado automático."
    >
      <LoadingDemo />
    </Section>
  );
}
