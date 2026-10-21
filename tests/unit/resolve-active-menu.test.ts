import { describe, expect, it } from "vitest";
import {
  resolveActiveMenu,
  resolveNextMenu,
  type ResolverInput,
  type ResolverOverride,
  type ResolverRule,
} from "@/features/schedule/resolve-active-menu";
import { gtInstant } from "@/lib/gt-time";

// 2026-10-20 es martes. Viernes 23, sábado 24, domingo 25.
const TUE = "2026-10-20";
const FRI = "2026-10-23";
const SAT = "2026-10-24";
const SUN = "2026-10-25";
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return gtInstant(date, h! * 60 + m!);
};

const ZONA1 = "zona-1";
const ANTIGUA = "antigua";

const slots = [
  {
    id: "desayuno",
    key: "breakfast",
    name: "Desayunos",
    start_time: "06:30",
    end_time: "11:00",
    is_active: true,
  },
  {
    id: "almuerzo",
    key: "lunch",
    name: "Almuerzo",
    start_time: "11:30",
    end_time: "15:30",
    is_active: true,
  },
  {
    id: "cena",
    key: "dinner",
    name: "Cena",
    start_time: "17:30",
    end_time: "21:30",
    is_active: true,
  },
  {
    id: "noche",
    key: "custom",
    name: "Noche de tragos",
    start_time: "22:00",
    end_time: "02:00",
    is_active: true,
  },
] as const;

const menus = [
  { id: "m-carta", is_active: true, is_default: true },
  { id: "m-desayunos", is_active: true, is_default: false },
  { id: "m-ejecutivo", is_active: true, is_default: false },
  { id: "m-noche", is_active: true, is_default: false },
  { id: "m-navidad", is_active: true, is_default: false },
  { id: "m-pausado", is_active: false, is_default: false },
  { id: "m-oculto", is_active: true, is_default: false, hidden_by_license: true },
];

const ALL = [0, 1, 2, 3, 4, 5, 6];
const rule = (over: Partial<ResolverRule>): ResolverRule => ({
  menu_id: "m-ejecutivo",
  time_slot_id: "almuerzo",
  branch_id: null,
  weekdays: [1, 2, 3, 4, 5],
  priority: 0,
  ...over,
});

const baseRules: ResolverRule[] = [
  rule({ menu_id: "m-desayunos", time_slot_id: "desayuno", weekdays: ALL }),
  rule({}), // almuerzo ejecutivo L–V
  rule({ menu_id: "m-carta", weekdays: [0, 6] }),
  rule({ menu_id: "m-carta", time_slot_id: "cena", weekdays: ALL }),
  rule({ menu_id: "m-noche", time_slot_id: "noche", weekdays: [5, 6] }), // viernes y sábado
  rule({ menu_id: "m-carta", branch_id: ANTIGUA, priority: 10 }), // Antigua: carta L–V en el almuerzo
];

const input = (over: Partial<ResolverInput> = {}): ResolverInput => ({
  branchId: ZONA1,
  slots: [...slots],
  menus,
  rules: baseRules,
  overrides: [],
  ...over,
});

const closed = (o: Partial<ResolverOverride>): ResolverOverride => ({
  branch_id: null,
  date: TUE,
  time_slot_id: null,
  menu_id: null,
  note: null,
  ...o,
});

describe("programación: sucursal vs. general", () => {
  it("martes al almuerzo, Zona 1 ve el ejecutivo (regla general)", () => {
    expect(resolveActiveMenu(input(), at(TUE, "12:00"))).toMatchObject({
      status: "open",
      menuId: "m-ejecutivo",
      reason: "schedule_general",
      slot: { id: "almuerzo" },
    });
  });

  it("la regla de Antigua gana a la general en la misma franja", () => {
    expect(resolveActiveMenu(input({ branchId: ANTIGUA }), at(TUE, "12:00"))).toMatchObject({
      menuId: "m-carta",
      reason: "schedule_branch",
    });
  });

  it("donde Antigua no tiene regla (cena) hereda la general", () => {
    expect(resolveActiveMenu(input({ branchId: ANTIGUA }), at(TUE, "19:00"))).toMatchObject({
      menuId: "m-carta",
      reason: "schedule_general",
    });
  });

  it("el sábado al almuerzo la general cambia a la carta", () => {
    expect(resolveActiveMenu(input(), at(SAT, "13:00")).menuId).toBe("m-carta");
  });
});

describe("empates y prioridades", () => {
  it("entre reglas de sucursal gana la de mayor prioridad", () => {
    const rules = [
      ...baseRules,
      rule({ menu_id: "m-noche", branch_id: ANTIGUA, priority: 20, weekdays: [2] }),
    ];
    expect(resolveActiveMenu(input({ branchId: ANTIGUA, rules }), at(TUE, "12:00")).menuId).toBe(
      "m-noche",
    );
  });

  it("con la misma prioridad, la de temporada (con fechas) gana a la semanal", () => {
    const rules = [
      ...baseRules,
      rule({ menu_id: "m-navidad", starts_on: "2026-10-01", ends_on: "2026-10-31", weekdays: [2] }),
    ];
    expect(resolveActiveMenu(input({ rules }), at(TUE, "12:00")).menuId).toBe("m-navidad");
  });

  it("empate total: resultado determinista (el mismo en cualquier orden)", () => {
    const tie = [rule({ menu_id: "m-noche" }), rule({ menu_id: "m-desayunos" })];
    const a = resolveActiveMenu(input({ rules: tie }), at(TUE, "12:00")).menuId;
    const b = resolveActiveMenu(input({ rules: [...tie].reverse() }), at(TUE, "12:00")).menuId;
    expect(a).toBe("m-desayunos");
    expect(b).toBe(a);
  });

  it("una regla de temporada fuera de sus fechas no aplica", () => {
    const rules = [
      ...baseRules,
      rule({ menu_id: "m-navidad", starts_on: "2026-12-01", ends_on: "2026-12-31", priority: 50 }),
    ];
    expect(resolveActiveMenu(input({ rules }), at(TUE, "12:00")).menuId).toBe("m-ejecutivo");
  });
});

describe("feriados y fechas especiales", () => {
  it("feriado general “Cerrado” cierra todas las sucursales", () => {
    const overrides = [closed({ note: "Feriado" })];
    for (const branchId of [ZONA1, ANTIGUA]) {
      expect(resolveActiveMenu(input({ branchId, overrides }), at(TUE, "12:00"))).toMatchObject({
        status: "closed",
        menuId: null,
        reason: "override_general",
        message: "Cerrado: Feriado",
      });
    }
  });

  it("“Cerrado hoy” de una sucursal no afecta a la otra", () => {
    const overrides = [closed({ branch_id: ANTIGUA })];
    expect(
      resolveActiveMenu(input({ branchId: ANTIGUA, overrides }), at(TUE, "12:00")).status,
    ).toBe("closed");
    expect(resolveActiveMenu(input({ branchId: ZONA1, overrides }), at(TUE, "12:00")).menuId).toBe(
      "m-ejecutivo",
    );
  });

  it("la fecha especial de la sucursal gana a la general", () => {
    const overrides = [
      closed({ note: "Feriado" }),
      closed({ branch_id: ANTIGUA, menu_id: "m-navidad" }),
    ];
    expect(
      resolveActiveMenu(input({ branchId: ANTIGUA, overrides }), at(TUE, "12:00")),
    ).toMatchObject({
      status: "open",
      menuId: "m-navidad",
      reason: "override_branch",
    });
  });

  it("una fecha especial de una sola franja no toca las demás", () => {
    const overrides = [closed({ time_slot_id: "cena", menu_id: "m-navidad" })];
    expect(resolveActiveMenu(input({ overrides }), at(TUE, "19:00")).menuId).toBe("m-navidad");
    expect(resolveActiveMenu(input({ overrides }), at(TUE, "12:00")).menuId).toBe("m-ejecutivo");
  });

  it("la de una franja gana a la de todo el día en el mismo alcance", () => {
    const overrides = [closed({}), closed({ time_slot_id: "almuerzo", menu_id: "m-navidad" })];
    expect(resolveActiveMenu(input({ overrides }), at(TUE, "12:00")).menuId).toBe("m-navidad");
    expect(resolveActiveMenu(input({ overrides }), at(TUE, "19:00")).status).toBe("closed");
  });

  it("“Cerrado” de todo el día manda también fuera de franja", () => {
    expect(resolveActiveMenu(input({ overrides: [closed({})] }), at(TUE, "16:00"))).toMatchObject({
      status: "closed",
      slot: null,
    });
  });

  it("un menú especial en pausa no aplica: sigue la programación", () => {
    const overrides = [closed({ menu_id: "m-pausado" })];
    expect(resolveActiveMenu(input({ overrides }), at(TUE, "12:00")).menuId).toBe("m-ejecutivo");
  });
});

describe("medianoche", () => {
  it("el sábado a la 01:00 sigue siendo la noche del viernes", () => {
    expect(resolveActiveMenu(input(), at(SAT, "01:00"))).toMatchObject({
      status: "open",
      menuId: "m-noche",
      slot: { id: "noche" },
    });
  });

  it("el lunes a la 01:00 es la noche del domingo, que no tiene regla → predeterminado", () => {
    expect(resolveActiveMenu(input(), at("2026-10-26", "01:00"))).toMatchObject({
      status: "default",
      menuId: "m-carta",
      slot: { id: "noche" },
    });
  });

  it("en la cola de medianoche aplica la fecha especial del día en que empezó", () => {
    const overrides = [closed({ date: FRI, time_slot_id: "noche", note: "Evento privado" })];
    expect(resolveActiveMenu(input({ overrides }), at(SAT, "01:30")).status).toBe("closed");
    // La del sábado no cuenta a la 01:30 del sábado.
    const satOverride = [closed({ date: SAT, time_slot_id: "noche" })];
    expect(resolveActiveMenu(input({ overrides: satOverride }), at(SAT, "01:30")).menuId).toBe(
      "m-noche",
    );
  });

  it("la hora se toma en Guatemala (UTC-6), no en UTC", () => {
    // Miércoles 01:30 UTC = martes 19:30 en Guatemala → cena del martes.
    expect(resolveActiveMenu(input(), new Date("2026-10-21T01:30:00Z"))).toMatchObject({
      menuId: "m-carta",
      slot: { id: "cena" },
    });
  });
});

describe("bordes de franja y fuera de horario", () => {
  it("al minuto exacto del inicio ya está en la franja", () => {
    expect(resolveActiveMenu(input(), at(TUE, "11:30")).slot?.id).toBe("almuerzo");
  });

  it("al minuto exacto del fin ya no: muestra el próximo con aviso", () => {
    expect(resolveActiveMenu(input(), at(TUE, "15:30"))).toMatchObject({
      status: "upcoming",
      menuId: "m-carta",
      slot: { id: "cena" },
      message: "La cena empieza a las 17:30",
    });
  });

  it("de madrugada (antes del desayuno) avisa la próxima franja de hoy", () => {
    expect(resolveActiveMenu(input(), at(TUE, "05:00"))).toMatchObject({
      status: "upcoming",
      menuId: "m-desayunos",
      message: "El desayuno empieza a las 06:30",
    });
  });

  it("sin franjas de noche, después de la cena avisa el desayuno de mañana", () => {
    const daySlots = slots.filter((s) => s.id !== "noche");
    expect(resolveActiveMenu(input({ slots: daySlots }), at(TUE, "23:00"))).toMatchObject({
      status: "upcoming",
      menuId: "m-desayunos",
      message: "El desayuno empieza mañana a las 06:30",
    });
  });

  it("una franja personalizada usa su nombre en el aviso", () => {
    expect(resolveActiveMenu(input(), at(FRI, "21:45"))).toMatchObject({
      status: "upcoming",
      message: "Noche de tragos empieza a las 22:00",
    });
  });
});

describe("predeterminado y datos incompletos", () => {
  it("en franja sin regla se ve el predeterminado", () => {
    expect(resolveActiveMenu(input({ rules: [] }), at(TUE, "12:00"))).toMatchObject({
      status: "default",
      menuId: "m-carta",
      reason: "default",
    });
  });

  it("sin franjas siempre se ve el predeterminado (plan Gratis)", () => {
    expect(resolveActiveMenu(input({ slots: [] }), at(SUN, "12:00"))).toMatchObject({
      status: "default",
      menuId: "m-carta",
      slot: null,
    });
  });

  it("las franjas en pausa no cuentan", () => {
    const paused = slots.map((s) => (s.id === "almuerzo" ? { ...s, is_active: false } : s));
    expect(resolveActiveMenu(input({ slots: paused }), at(TUE, "12:00"))).toMatchObject({
      status: "upcoming",
      slot: { id: "cena" },
    });
  });

  it("reglas de menús en pausa u ocultos por el plan se saltan", () => {
    const rules = [
      rule({ menu_id: "m-pausado", priority: 9 }),
      rule({ menu_id: "m-oculto", priority: 8 }),
      ...baseRules,
    ];
    expect(resolveActiveMenu(input({ rules }), at(TUE, "12:00")).menuId).toBe("m-ejecutivo");
  });

  it("sin predeterminado y sin reglas: no hay menú", () => {
    const noDefault = menus.map((m) => ({ ...m, is_default: false }));
    expect(
      resolveActiveMenu(input({ rules: [], menus: noDefault }), at(TUE, "12:00")).menuId,
    ).toBeNull();
  });
});

describe("siguiente menú (panel)", () => {
  it("durante el almuerzo, el siguiente es la cena", () => {
    expect(resolveNextMenu(input(), at(TUE, "12:00"))).toMatchObject({
      menuId: "m-carta",
      slot: { id: "cena" },
      tomorrow: false,
    });
  });

  it("durante la última franja, el siguiente es el desayuno de mañana", () => {
    const daySlots = slots.filter((s) => s.id !== "noche");
    expect(resolveNextMenu(input({ slots: daySlots }), at(TUE, "19:00"))).toMatchObject({
      menuId: "m-desayunos",
      tomorrow: true,
    });
  });
});
