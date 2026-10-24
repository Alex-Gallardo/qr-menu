import {
  CheckIcon,
  ClockIcon,
  CopyIcon,
  ImageIcon,
  LocateFixedIcon,
  MapPinIcon,
  MessageCircleIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  ShoppingBagIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavIcon } from "@/features/panel/components/nav-icon";
import { NAV_GROUPS, type NavIcon as NavIconName } from "@/features/panel/nav";
import { Section } from "./section";

const SIZES = [
  { px: 16, cls: "size-4", use: "Dentro de texto chico y botones sm" },
  { px: 20, cls: "size-5", use: "Botones y navegación (por defecto)" },
  { px: 24, cls: "size-6", use: "Acciones grandes, teclado de PIN" },
] as const;

const UI_ICONS: [string, LucideIcon][] = [
  ["Agregar", PlusIcon],
  ["Quitar uno", MinusIcon],
  ["Eliminar", Trash2Icon],
  ["Buscar", SearchIcon],
  ["Carrito", ShoppingBagIcon],
  ["WhatsApp", MessageCircleIcon],
  ["Programado", ClockIcon],
  ["Dirección", MapPinIcon],
  ["Mi ubicación", LocateFixedIcon],
  ["Copiar", CopyIcon],
  ["Sin foto", ImageIcon],
  ["Listo", CheckIcon],
];

const NAV_ICONS = NAV_GROUPS.flatMap((g) => g.items).map((i) => [i.label, i.icon] as const);

export function IconsSection() {
  return (
    <Section
      id="iconografia"
      number={6}
      title="Iconografía"
      description="Lucide con trazo 1.75 (regla global en globals.css), en 16, 20 y 24 px. Siempre acompañados de texto o con aria-label; los decorativos llevan aria-hidden."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {SIZES.map((s) => (
          <div key={s.px} className="rounded-lg border border-border bg-card p-4 shadow-1">
            <div className="flex flex-wrap gap-3">
              {UI_ICONS.slice(0, 6).map(([label, Icon]) => (
                <Icon key={label} aria-hidden className={s.cls} />
              ))}
            </div>
            <p className="type-caption mt-3">
              <span className="font-mono font-semibold">{s.px} px</span> · {s.use}
            </p>
          </div>
        ))}
      </div>

      <h3 className="type-h3 mt-8">Interfaz</h3>
      <IconGrid items={UI_ICONS.map(([label, Icon]) => ({ label, icon: <Icon aria-hidden /> }))} />

      <h3 className="type-h3 mt-8">Panel</h3>
      <IconGrid
        items={NAV_ICONS.map(([label, name]) => ({
          label,
          icon: <NavIcon name={name as NavIconName} className="size-5" />,
        }))}
      />
    </Section>
  );
}

function IconGrid({ items }: { items: { label: string; icon: ReactNode }[] }) {
  return (
    <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((i) => (
        <li
          key={i.label}
          className="type-caption grid justify-items-center gap-2 rounded-md border border-border bg-card p-3 text-center [&_svg]:size-5"
        >
          {i.icon}
          {i.label}
        </li>
      ))}
    </ul>
  );
}
