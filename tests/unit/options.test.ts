import { describe, expect, it } from "vitest";
import {
  checkSelection,
  deltaToInput,
  describeGroup,
  groupRuleProblem,
  hasRequiredGroups,
  parseDelta,
  type OptionGroup,
} from "@/features/products/options";

const opt = (id: string, delta = 0, is_available = true) => ({
  id,
  name: id,
  price_delta_cents: delta,
  is_available,
});

const tamano: OptionGroup = {
  id: "tamano",
  name: "Tamaño",
  min_select: 1,
  max_select: 1,
  options: [opt("mediano"), opt("grande", 500)],
};

const extras: OptionGroup = {
  id: "extras",
  name: "Extras",
  min_select: 0,
  max_select: 3,
  options: [
    opt("queso", 500),
    opt("aguacate", 800),
    opt("tocino", 1000),
    opt("huevo", 600, false),
    opt("chile", 0),
  ],
};

describe("“Tamaño” obligatorio y “Extras” 0–3", () => {
  const groups = [tamano, extras];

  it("sin tamaño no se puede agregar", () => {
    const r = checkSelection(groups, []);
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual([{ groupId: "tamano", message: "Elige tu tamaño." }]);
  });

  it("con tamaño y sin extras está bien", () => {
    expect(checkSelection(groups, ["mediano"])).toEqual({ ok: true, problems: [], deltaCents: 0 });
  });

  it("dos tamaños es demasiado", () => {
    const r = checkSelection(groups, ["mediano", "grande"]);
    expect(r.problems.map((p) => p.message)).toEqual(["Puedes elegir hasta 1 en Tamaño."]);
  });

  it("hasta 3 extras suman su precio; 4 no se permiten", () => {
    expect(checkSelection(groups, ["grande", "queso", "aguacate", "tocino"])).toMatchObject({
      ok: true,
      deltaCents: 500 + 500 + 800 + 1000,
    });
    const four = checkSelection(groups, ["grande", "queso", "aguacate", "tocino", "chile"]);
    expect(four.ok).toBe(false);
    expect(four.problems[0]!.message).toBe("Puedes elegir hasta 3 en Extras.");
  });

  it("una opción agotada o que ya no existe se rechaza; repetidas cuentan una vez", () => {
    expect(checkSelection(groups, ["mediano", "huevo"]).problems[0]!.message).toMatch(
      /se nos acabó/,
    );
    expect(checkSelection(groups, ["mediano", "inventada"]).ok).toBe(false);
    expect(checkSelection(groups, ["grande", "queso", "queso"]).deltaCents).toBe(1000);
  });

  it("el “+” directo solo si no hay grupos obligatorios", () => {
    expect(hasRequiredGroups(groups)).toBe(true);
    expect(hasRequiredGroups([extras])).toBe(false);
  });
});

describe("reglas del grupo", () => {
  it("describe cada caso en español", () => {
    expect(describeGroup(tamano)).toBe("Obligatorio · elige 1");
    expect(describeGroup(extras)).toBe("Opcional · hasta 3");
    expect(describeGroup({ min_select: 0, max_select: 1 })).toBe("Opcional · elige 1");
    expect(describeGroup({ min_select: 1, max_select: 2 })).toBe("Obligatorio · elige de 1 a 2");
    expect(describeGroup({ min_select: 2, max_select: 2 })).toBe("Obligatorio · elige 2");
  });

  it("detecta reglas imposibles", () => {
    expect(groupRuleProblem({ min_select: 1, max_select: 1 }, 2)).toBeNull();
    expect(groupRuleProblem({ min_select: 0, max_select: 3 }, 5)).toBeNull();
    expect(groupRuleProblem({ min_select: 1, max_select: 1 }, 0)).toMatch(/al menos una/);
    expect(groupRuleProblem({ min_select: 2, max_select: 1 }, 3)).toMatch(/mínimo/);
    expect(groupRuleProblem({ min_select: 0, max_select: 4 }, 3)).toMatch(/Solo hay 3/);
    expect(groupRuleProblem({ min_select: 0, max_select: 0 }, 3)).not.toBeNull();
  });
});

describe("precio de la opción", () => {
  it("acepta montos con signo", () => {
    expect(parseDelta("")).toBe(0);
    expect(parseDelta("5")).toBe(500);
    expect(parseDelta("+5.50")).toBe(550);
    expect(parseDelta("Q -2.5")).toBe(-250);
    expect(parseDelta("abc")).toBeNull();
    expect(parseDelta("-")).toBeNull();
  });

  it("vuelve al texto del input", () => {
    expect(deltaToInput(0)).toBe("");
    expect(deltaToInput(500)).toBe("5");
    expect(deltaToInput(-250)).toBe("-2.50");
  });
});
