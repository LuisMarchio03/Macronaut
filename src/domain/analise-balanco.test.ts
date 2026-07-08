import { describe, it, expect } from "vitest";
import { balancoEnergetico } from "./analise-balanco";

describe("balancoEnergetico", () => {
  it("saldo = ingerido − gasto (déficit)", () => {
    const ing = new Map<string, number>([["2026-07-06", 2000], ["2026-07-07", 1800]]);
    const gasto = new Map<string, number>([["2026-07-06", 500], ["2026-07-07", 400]]);
    expect(balancoEnergetico(ing, gasto)).toEqual({ ingerido: 3800, gasto: 900, saldo: 2900 });
  });
  it("sem atividade → gasto 0, saldo = ingerido", () => {
    const ing = new Map<string, number>([["2026-07-06", 1500]]);
    expect(balancoEnergetico(ing, new Map())).toEqual({ ingerido: 1500, gasto: 0, saldo: 1500 });
  });
  it("saldo negativo quando gasto > ingerido", () => {
    const ing = new Map<string, number>([["2026-07-06", 100]]);
    const gasto = new Map<string, number>([["2026-07-06", 300]]);
    expect(balancoEnergetico(ing, gasto).saldo).toBe(-200);
  });
});
