import { MessageCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "./section";

// hover: la misma clase que pone buttonVariants al pasar el mouse (para verla fija).
const VARIANTS = [
  { variant: "default", label: "Primario", hover: "bg-tomate-700" },
  { variant: "secondary", label: "Secundario", hover: "bg-[#e8e0d6]" },
  { variant: "outline", label: "Contorno", hover: "bg-muted" },
  { variant: "ghost", label: "Fantasma", hover: "bg-muted" },
  { variant: "destructive", label: "Eliminar", hover: "bg-[#a82626]" },
  { variant: "whatsapp", label: "Pedir por WhatsApp", hover: "bg-[#1fbe5b]" },
] as const;

const STATES = ["Normal", "Hover", "Presionado", "Foco", "Deshabilitado", "Cargando"] as const;

export function ButtonsSection() {
  return (
    <Section
      id="botones"
      number={7}
      title="Botones"
      description="48 px de alto por defecto. Hover oscurece el fondo; presionado escala a 0.96 en 120 ms; el foco de teclado muestra un anillo de 3 px. “Cargando” muestra spinner, deshabilita y evita dobles envíos."
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-1">
        <table className="w-full min-w-[1080px] text-left">
          <thead>
            <tr className="type-caption border-b border-border text-muted-foreground">
              <th className="p-3 font-semibold">Variante</th>
              {STATES.map((s) => (
                <th key={s} className="p-3 font-semibold">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VARIANTS.map(({ variant, label, hover }) => {
              const icon = variant === "whatsapp" ? <MessageCircleIcon /> : null;
              return (
                <tr key={variant} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-sm">{variant}</td>
                  <td className="p-3">
                    <Button variant={variant}>
                      {icon}
                      {label}
                    </Button>
                  </td>
                  <td className="p-3">
                    <Button variant={variant} className={hover}>
                      {icon}
                      {label}
                    </Button>
                  </td>
                  <td className="p-3">
                    <Button variant={variant} className={`${hover} scale-[0.96]`}>
                      {icon}
                      {label}
                    </Button>
                  </td>
                  <td className="p-3">
                    <Button variant={variant} className="ring-3 ring-ring/50">
                      {icon}
                      {label}
                    </Button>
                  </td>
                  <td className="p-3">
                    <Button variant={variant} disabled>
                      {icon}
                      {label}
                    </Button>
                  </td>
                  <td className="p-3">
                    <Button variant={variant} loading>
                      {icon}
                      {label}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="type-h3 mt-8">Tamaños e íconos</h3>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm">Chico · 40</Button>
        <Button>Mediano · 48</Button>
        <Button size="lg">Grande · 56</Button>
        <Button size="icon" aria-label="Agregar">
          <PlusIcon />
        </Button>
        <Button size="icon-sm" variant="secondary" aria-label="Agregar">
          <PlusIcon />
        </Button>
        <Button size="icon" variant="destructive" aria-label="Eliminar">
          <Trash2Icon />
        </Button>
        <Button variant="link">Enlace</Button>
      </div>
    </Section>
  );
}
