import { describe, it, expect } from "vitest";
import { macrosDoEntry, totaisDoDia, restante } from "./nutrition";
import type { Food, FoodEntry } from "./types";

const arroz: Food = {
  id: 1, nome: "Arroz cozido", source: "taco", marca: null,
  base_qty_g: 100, kcal: 128, prot_g: 2.5, carb_g: 28, gord_g: 0.2,
  created_at: "2026-07-06T00:00:00Z",
};

describe("macrosDoEntry", () => {
  it("escala pelos gramas sobre base_qty_g", () => {
    const m = macrosDoEntry(arroz, 150);
    expect(m.kcal).toBeCloseTo(192, 0);
    expect(m.prot_g).toBeCloseTo(3.75, 2);
    expect(m.carb_g).toBeCloseTo(42, 0);
  });
});

describe("totaisDoDia", () => {
  it("soma todos os entries", () => {
    const foods = new Map<number, Food>([[1, arroz]]);
    const entries: FoodEntry[] = [
      { id: 1, data: "2026-07-06", meal_id: 1, food_id: 1, qty_g: 100, label: null, created_at: "" },
      { id: 2, data: "2026-07-06", meal_id: 1, food_id: 1, qty_g: 100, label: null, created_at: "" },
    ];
    expect(totaisDoDia(entries, foods).kcal).toBeCloseTo(256, 0);
  });
  it("ignora entry cujo food sumiu do mapa", () => {
    expect(totaisDoDia(
      [{ id: 9, data: "2026-07-06", meal_id: null, food_id: 999, qty_g: 100, label: null, created_at: "" }],
      new Map(),
    ).kcal).toBe(0);
  });
});

describe("restante", () => {
  it("subtrai consumido da meta por campo (pode ficar negativo)", () => {
    const r = restante(
      { kcal: 2000, prot_g: 160, carb_g: 200, gord_g: 55 },
      { kcal: 2100, prot_g: 120, carb_g: 210, gord_g: 40 },
    );
    expect(r.kcal).toBe(-100);
    expect(r.prot_g).toBe(40);
  });
});
