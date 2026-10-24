import { LogoSymbol } from "@/components/brand/logo";

const ITEMS = [
  { name: "Desayuno chapín", detail: "Huevos, frijoles, plátanos y crema", price: "Q45" },
  { name: "Almuerzo ejecutivo", detail: "Sopa, plato fuerte y refresco", price: "Q55" },
  { name: "Café de olla", detail: "Con canela y panela", price: "Q15" },
];

/**
 * Celular del hero: la bienvenida de un restaurante se levanta y revela su
 * menú del día. Solo CSS (sin JavaScript), en bucle; quieto con "reducir movimiento".
 */
export function HeroPhone() {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[520px] w-[260px] shrink-0 overflow-hidden rounded-[36px] border-[10px] border-frijol bg-frijol shadow-3"
    >
      <div className="relative h-full overflow-hidden rounded-[26px] bg-[#FBF6EE]">
        <div className="hero-menu grid gap-3 p-4 pt-6">
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-full bg-tomate text-lg font-bold text-white">
              P
            </span>
            <div>
              <p className="font-display text-base leading-tight font-bold text-frijol">
                Café El Portal
              </p>
              <p className="text-[11px] text-[#6B5B55]">Zona 1 · Abierto</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {["Desayuno", "Almuerzo", "Cena"].map((t, i) => (
              <span
                key={t}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${i === 1 ? "bg-tomate text-white" : "bg-white text-frijol"}`}
              >
                {t}
              </span>
            ))}
          </div>
          <p className="font-display text-sm font-bold text-frijol">Menú del día</p>
          {ITEMS.map((item) => (
            <div key={item.name} className="flex gap-2 rounded-xl bg-white p-2.5 shadow-1">
              <span className="size-12 shrink-0 rounded-lg bg-gradient-to-br from-maiz to-tomate opacity-80" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] leading-tight font-semibold text-frijol">
                  {item.name}
                </span>
                <span className="block truncate text-[10px] text-[#6B5B55]">{item.detail}</span>
                <span className="block text-[12px] font-bold text-tomate">{item.price}</span>
              </span>
            </div>
          ))}
          <div className="mt-1 rounded-full bg-[#25D366] py-2 text-center text-[11px] font-semibold text-frijol">
            Pedir por WhatsApp · Q100
          </div>
        </div>
        <div className="hero-splash absolute inset-0 grid place-content-center justify-items-center gap-2 bg-tomate">
          <span className="grid size-16 place-items-center rounded-2xl bg-white">
            <LogoSymbol className="size-11" />
          </span>
          <span className="font-display text-lg font-bold text-white">Café El Portal</span>
        </div>
      </div>
    </div>
  );
}
