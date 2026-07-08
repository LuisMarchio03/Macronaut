import { describe, it, expect } from "vitest";
import taco from "./taco.json";
import type { TacoItem } from "../domain/taco";

const itens = taco as TacoItem[];

describe("taco.json", () => {
  it("tem uma base substancial de alimentos", () => {
    expect(Array.isArray(itens)).toBe(true);
    expect(itens.length).toBeGreaterThanOrEqual(400);
  });
  it("todo item tem shape válido e números finitos", () => {
    for (const it of itens) {
      expect(typeof it.nome).toBe("string");
      expect(it.nome.length).toBeGreaterThan(0);
      expect(it.base_qty_g).toBe(100);
      for (const k of ["kcal", "prot_g", "carb_g", "gord_g"] as const) {
        expect(Number.isFinite(it[k])).toBe(true);
        expect(it[k]).toBeGreaterThanOrEqual(0);
      }
      expect(it.kcal).toBeLessThanOrEqual(1000);
    }
  });
});
