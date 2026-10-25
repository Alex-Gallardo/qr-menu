"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { PALETTE_PRESETS } from "@/features/appearance/palettes";
import { MENU_TEMPLATES } from "@/features/menus/structure";
import type { MenuTemplateId } from "@/features/public-menu/templates";

/**
 * Selector de arriba (guía §12): "marca" (landing/panel) o cualquiera de las 8
 * paletas, y una de las 4 plantillas. Lo leen las demos del menú y de la bienvenida.
 */
type Choice = { palette: string; template: MenuTemplateId };

const Ctx = createContext<{ value: Choice; set: (v: Partial<Choice>) => void } | null>(null);

export function StyleguideThemeProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<Choice>({ palette: "marca", template: "clasico" });
  return (
    <Ctx.Provider value={{ value, set: (v) => setValue((p) => ({ ...p, ...v })) }}>
      {children}
    </Ctx.Provider>
  );
}

/** Paleta para el menú: "marca" usa la de la plataforma (Tomate). */
export function useStyleguideTheme() {
  const ctx = useContext(Ctx);
  const value = ctx?.value ?? { palette: "marca", template: "clasico" as MenuTemplateId };
  return { ...value, menuPalette: value.palette === "marca" ? "tomate" : value.palette };
}

export function ThemePicker() {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const { value, set } = ctx;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="type-caption flex items-center gap-2 font-semibold">
        Tema
        <select
          value={value.palette}
          onChange={(e) => set({ palette: e.target.value })}
          className="type-small h-9 rounded-full border border-border bg-card px-3"
        >
          <option value="marca">Marca (landing y panel)</option>
          {PALETTE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              Paleta {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="type-caption flex items-center gap-2 font-semibold">
        Plantilla
        <select
          value={value.template}
          onChange={(e) => set({ template: e.target.value as MenuTemplateId })}
          className="type-small h-9 rounded-full border border-border bg-card px-3"
        >
          {MENU_TEMPLATES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
