import { A11yDemo } from "./a11y-demo";
import { Section } from "./section";

export function A11ySection() {
  return (
    <Section
      id="accesibilidad"
      number={17}
      title="Accesibilidad"
      description="WCAG 2.2 AA: foco visible, objetivos táctiles de 44–48 px, contraste de 4.5:1 y anuncios con aria-live."
    >
      <A11yDemo />
    </Section>
  );
}
