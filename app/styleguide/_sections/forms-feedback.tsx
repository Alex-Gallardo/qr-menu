import { FeedbackDemo } from "./feedback-demo";
import { FormsDemo } from "./forms-demo";
import { Section } from "./section";

export function FormsSection() {
  return (
    <Section
      id="formularios"
      number={8}
      title="Formularios"
      description="Inputs de 48 px y texto de 16 px (sin zoom en iOS). Error y ayuda conectados al campo con aria-describedby. Prefijos fijos para teléfono (+502) y precio (Q)."
    >
      <FormsDemo />
    </Section>
  );
}

export function FeedbackSection() {
  return (
    <Section
      id="feedback"
      number={14}
      title="Feedback"
      description="Mensajes de resultado, estados vacíos que enseñan qué hacer, toasts, modales, hojas inferiores y banners."
    >
      <FeedbackDemo />
    </Section>
  );
}
