import { describe, expect, it } from "vitest";
import { formatQ } from "@/lib/money";

describe("formatQ", () => {
  it("formatea centavos como quetzales", () => {
    expect(formatQ(13100)).toBe("Q131.00");
    expect(formatQ(850)).toBe("Q8.50");
    expect(formatQ(0)).toBe("Q0.00");
    expect(formatQ(149000)).toBe("Q1,490.00");
    expect(formatQ(-1500)).toBe("-Q15.00");
  });

  it("rechaza montos con decimales", () => {
    expect(() => formatQ(10.5)).toThrow();
  });
});
