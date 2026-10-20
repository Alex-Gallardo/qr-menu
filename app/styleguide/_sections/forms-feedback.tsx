import { UtensilsCrossedIcon } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "./section";

export function FormsSection() {
  return (
    <Section
      id="formularios"
      number={8}
      title="Formularios"
      description="Inputs de 48 px y texto de 16 px (sin zoom en iOS). Error y ayuda conectados al campo."
    >
      <div className="grid max-w-md gap-5 rounded-lg border border-border bg-card p-5 shadow-1">
        <Field id="sg-normal" label="Nombre del negocio" hint="Así lo verán tus clientes.">
          <Input id="sg-normal" placeholder="Café El Portal" />
        </Field>
        <Field id="sg-error" label="Correo" error="Ese correo no parece válido.">
          <Input id="sg-error" defaultValue="cafe@" aria-invalid />
        </Field>
        <Field id="sg-disabled" label="Link">
          <Input id="sg-disabled" defaultValue="cafe-el-portal" disabled />
        </Field>
      </div>
    </Section>
  );
}

export function FeedbackSection() {
  return (
    <Section
      id="feedback"
      number={14}
      title="Feedback"
      description="Mensajes de resultado y estados vacíos que enseñan qué hacer."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <FormMessage tone="success">¡Listo! Guardamos tus cambios.</FormMessage>
          <FormMessage tone="error">No pudimos guardar la foto. Probemos otra vez.</FormMessage>
        </div>
        <EmptyState
          icon={<UtensilsCrossedIcon />}
          title="Aún no tienes productos"
          action={<Button size="sm">Agregar mi primer producto</Button>}
        >
          Agrega tus platillos una vez y úsalos en todos tus menús.
        </EmptyState>
      </div>
    </Section>
  );
}
