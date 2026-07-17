import { describe, it, expect } from "vitest";
import { totaisPorDia, resumoNutricional } from "./analise-nutricao";
import type { Food, FoodEntry, Macros } from "./types";

const arroz: Food = {
  id: 1, nome: "Arroz", source: "taco", marca: null,
  base_qty_g: 100, base_unit: "g", default_measure_id: null,
  kcal: 100, prot_g: 2, carb_g: 20, gord_g: 1, fibra_g: null, sodio_mg: null, categoria: null, created_at: "",
};
const foods = new Map<number, Food>([[1, arroz]]);
const entry = (data: string, qty_g: number): FoodEntry =>
  ({ id: 0, data, meal_id: null, food_id: 1, qty_g, measure_id: null, measure_count: null, label: null, created_at: "" });

describe("totaisPorDia", () => {
  it("agrupa por data e soma", () => {
    const m = totaisPorDia([entry("2026-07-06", 100), entry("2026-07-06", 100), entry("2026-07-07", 200)], foods);
    expect(m.get("2026-07-06")).toEqual({ kcal: 200, prot_g: 4, carb_g: 40, gord_g: 2 });
    expect(m.get("2026-07-07")).toEqual({ kcal: 200, prot_g: 4, carb_g: 40, gord_g: 2 });
  });
  it("ignora entry cujo food não está no mapa", () => {
    const m = totaisPorDia([{ ...entry("2026-07-06", 100), food_id: 99 }], foods);
    expect(m.size).toBe(0);
  });
});

describe("resumoNutricional", () => {
  const meta: Macros = { kcal: 100, prot_g: 2, carb_g: 20, gord_g: 1 };
  it("média é sobre TODOS os dias do período, não só os registrados", () => {
    // 1 dia registrado com 100 kcal, período de 7 dias → média 100/7
    const totais = totaisPorDia([entry("2026-07-06", 100)], foods);
    const r = resumoNutricional(totais, meta, 7);
    expect(r.mediaKcal).toBeCloseTo(100 / 7, 5);
    expect(r.diasRegistrados).toBe(1);
    expect(r.diasNoPeriodo).toBe(7);
    expect(r.mediaProt).toBeCloseTo(2 / 7, 5);
  });
  it("diasDentroMeta conta dias dentro de ±10% da meta de kcal", () => {
    const totais = totaisPorDia([
      entry("2026-07-06", 100), // 100 kcal → dentro (meta 100)
      entry("2026-07-07", 95),  // 95 kcal → dentro (±10%)
      entry("2026-07-08", 150), // 150 kcal → fora
    ], foods);
    const r = resumoNutricional(totais, meta, 7);
    expect(r.diasDentroMeta).toBe(2);
  });
  it("aderenciaKcalPct = media/meta*100 arredondado", () => {
    const totais = totaisPorDia([entry("2026-07-06", 700)], foods); // 700 kcal em 7 dias → média 100
    expect(resumoNutricional(totais, meta, 7).aderenciaKcalPct).toBe(100);
  });
  it("meta.kcal = 0 → aderência 0, sem divisão por zero", () => {
    const totais = totaisPorDia([entry("2026-07-06", 100)], foods);
    const r = resumoNutricional(totais, { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 }, 7);
    expect(r.aderenciaKcalPct).toBe(0);
    expect(r.diasDentroMeta).toBe(0);
  });
  it("dia só com alimento de 0 kcal ainda conta como registrado", () => {
    const agua: Food = {
      id: 2, nome: "Água", source: "taco", marca: null,
      base_qty_g: 100, base_unit: "g", default_measure_id: null,
      kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0, fibra_g: null, sodio_mg: null, categoria: null, created_at: "",
    };
    const foods2 = new Map<number, Food>([[2, agua]]);
    const totais = totaisPorDia(
      [{ id: 0, data: "2026-07-06", meal_id: null, food_id: 2, qty_g: 500, measure_id: null, measure_count: null, label: null, created_at: "" }],
      foods2,
    );
    expect(resumoNutricional(totais, meta, 7).diasRegistrados).toBe(1);
  });
  it("±10% é inclusivo nas bordas (90 e 110)", () => {
    const totais = totaisPorDia([entry("2026-07-06", 90), entry("2026-07-07", 110), entry("2026-07-08", 111)], foods);
    expect(resumoNutricional(totais, meta, 7).diasDentroMeta).toBe(2);
  });
});
