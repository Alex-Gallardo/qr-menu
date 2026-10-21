import { describe, expect, it } from "vitest";
import {
  BRANCH_PRIORITY,
  cellKey,
  effectiveCell,
  fillWeek,
  gridFromRules,
  menuInitials,
  pruneGrid,
  rulesFromGrid,
  setCell,
  type ScheduleRule,
} from "@/features/schedule/grid";

const LUNCH = "slot-lunch";
const DINNER = "slot-dinner";
const ANTIGUA = "antigua";
const rule = (over: Partial<ScheduleRule>): ScheduleRule => ({
  menu_id: "almuerzo",
  time_slot_id: LUNCH,
  branch_id: null,
  weekdays: [1, 2, 3, 4, 5],
  priority: 0,
  ...over,
});

// Como el seed: almuerzo ejecutivo L–V y carta fines de semana; en Antigua, carta L–V.
const rules: ScheduleRule[] = [
  rule({}),
  rule({ menu_id: "carta", weekdays: [0, 6] }),
  rule({ menu_id: "carta", time_slot_id: DINNER, weekdays: [0, 1, 2, 3, 4, 5, 6] }),
  rule({ menu_id: "carta", branch_id: ANTIGUA, priority: BRANCH_PRIORITY }),
];

describe("regla de sucursal vs. general", () => {
  const general = gridFromRules(rules, null);
  const antigua = gridFromRules(rules, ANTIGUA);

  it("la regla de la sucursal gana a la general", () => {
    expect(effectiveCell(general, antigua, cellKey(LUNCH, 2))).toEqual({
      menuId: "carta",
      source: "branch",
    });
  });

  it("donde la sucursal no tiene regla, hereda la general", () => {
    expect(effectiveCell(general, antigua, cellKey(DINNER, 2))).toEqual({
      menuId: "carta",
      source: "general",
    });
    expect(effectiveCell(general, {}, cellKey(LUNCH, 2))).toEqual({
      menuId: "almuerzo",
      source: "general",
    });
  });

  it("otra sucursal sin reglas propias ve la general", () => {
    const zona1 = gridFromRules(rules, "zona-1");
    expect(zona1).toEqual({});
    expect(effectiveCell(general, zona1, cellKey(LUNCH, 2)).menuId).toBe("almuerzo");
  });

  it("celda vacía en ambas → sin menú (se usará el predeterminado)", () => {
    expect(effectiveCell(general, antigua, cellKey("slot-desayuno", 2))).toEqual({
      menuId: null,
      source: null,
    });
  });
});

describe("cuadrícula ↔ reglas", () => {
  it("lee solo el alcance pedido y las reglas semanales", () => {
    const withSeason = [
      ...rules,
      rule({ menu_id: "navidad", starts_on: "2026-12-01", ends_on: "2026-12-31" }),
    ];
    const general = gridFromRules(withSeason, null);
    expect(general[cellKey(LUNCH, 1)]).toBe("almuerzo");
    expect(Object.values(general)).not.toContain("navidad");
    expect(Object.keys(gridFromRules(rules, ANTIGUA))).toHaveLength(5);
  });

  it("si dos reglas caen en la misma celda gana la de mayor prioridad", () => {
    const grid = gridFromRules(
      [rule({ priority: 1 }), rule({ menu_id: "especial", priority: 5, weekdays: [3] })],
      null,
    );
    expect(grid[cellKey(LUNCH, 3)]).toBe("especial");
    expect(grid[cellKey(LUNCH, 2)]).toBe("almuerzo");
  });

  it("guarda compacto: una fila por franja y menú, días ordenados y prioridad por alcance", () => {
    const general = gridFromRules(rules, null);
    const back = rulesFromGrid(general, null);
    expect(back).toHaveLength(3);
    expect(back).toContainEqual({
      time_slot_id: LUNCH,
      menu_id: "carta",
      weekdays: [0, 6],
      branch_id: null,
      priority: 0,
    });
    expect(
      rulesFromGrid({ [cellKey(LUNCH, 5)]: "carta", [cellKey(LUNCH, 1)]: "carta" }, ANTIGUA),
    ).toEqual([
      {
        time_slot_id: LUNCH,
        menu_id: "carta",
        weekdays: [1, 5],
        branch_id: ANTIGUA,
        priority: BRANCH_PRIORITY,
      },
    ]);
  });

  it("es reversible: reglas → cuadrícula → reglas → misma cuadrícula", () => {
    const general = gridFromRules(rules, null);
    expect(gridFromRules(rulesFromGrid(general, null), null)).toEqual(general);
  });
});

describe("edición", () => {
  it("llenar la semana y vaciar una franja", () => {
    const full = fillWeek({}, LUNCH, "almuerzo");
    expect(Object.keys(full)).toHaveLength(7);
    expect(fillWeek(full, LUNCH, null)).toEqual({});
  });

  it("poner y quitar una celda sin tocar el original", () => {
    const grid = { [cellKey(LUNCH, 1)]: "almuerzo" };
    const next = setCell(grid, cellKey(LUNCH, 1), null);
    expect(next).toEqual({});
    expect(grid).toEqual({ [cellKey(LUNCH, 1)]: "almuerzo" });
  });

  it("quita celdas de franjas o menús que ya no existen", () => {
    const grid = {
      [cellKey(LUNCH, 1)]: "almuerzo",
      [cellKey("borrada", 1)]: "almuerzo",
      [cellKey(LUNCH, 2)]: "pausado",
    };
    expect(pruneGrid(grid, new Set([LUNCH]), new Set(["almuerzo"]))).toEqual({
      [cellKey(LUNCH, 1)]: "almuerzo",
    });
  });

  it("iniciales legibles para celdas angostas", () => {
    expect(menuInitials("Desayunos")).toBe("Des");
    expect(menuInitials("Almuerzo ejecutivo")).toBe("AE");
    expect(menuInitials("Cena y carta")).toBe("CC");
  });
});
