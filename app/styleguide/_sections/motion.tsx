import { MotionDemo } from "./motion-demo";
import { Section } from "./section";

export function MotionSection() {
  return (
    <Section
      id="movimiento"
      number={15}
      title="Movimiento"
      description="Movimiento corto y con propósito: confirma, orienta o da antojo. Casi todo dura 500 ms o menos; las excepciones son el confeti del pedido enviado y los indicadores de espera."
    >
      <MotionDemo />
    </Section>
  );
}
