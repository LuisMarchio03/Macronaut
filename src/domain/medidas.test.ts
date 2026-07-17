import { describe, it, expect } from "vitest";
import {
  resolverQtdBase, rotuloUnidade, formatarNumero, pluralizar, formatarRegistro,
} from "./medidas";
import type { Food, FoodEntry, FoodMeasure } from "./types";

const food: Food = {
  id: 1, nome: "Pão de forma", source: "custom", marca: null,
  base_qty_g: 100, base_unit: "g", default_measure_id: 10,
  kcal: 250, prot_g: 9, carb_g: 49, gord_g: 3, fibra_g: null, sodio_mg: null, categoria: null, created_at: "t",
};
const fatia: FoodMeasure = { id: 10, food_id: 1, nome: "fatia", qty_base: 25, ordem: 0, source: "manual", status: "confirmada", pof_codigo: null, pof_descricao: null };
const entry = (over: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 1, data: "2026-07-15", meal_id: null, food_id: 1,
  qty_g: 50, measure_id: 10, measure_count: 2, label: null, created_at: "t", ...over,
});

describe("resolverQtdBase", () => {
  it("multiplica a equivalência pela contagem", () => {
    expect(resolverQtdBase(25, 2)).toBe(50);
    expect(resolverQtdBase(200, 0.5)).toBe(100);
  });
});

describe("rotuloUnidade", () => {
  it("mapeia o enum para rótulo curto", () => {
    expect(rotuloUnidade("g")).toBe("g");
    expect(rotuloUnidade("ml")).toBe("ml");
    expect(rotuloUnidade("un")).toBe("un");
  });
});

describe("formatarNumero", () => {
  it("mostra inteiro sem casas e decimal com vírgula", () => {
    expect(formatarNumero(50)).toBe("50");
    expect(formatarNumero(0.5)).toBe("0,5");
    expect(formatarNumero(2.25)).toBe("2,25");
  });
});

describe("pluralizar", () => {
  it("mantém no singular quando count é 1", () => {
    expect(pluralizar("fatia", 1)).toBe("fatia");
  });
  it("pluraliza palavra única acrescentando s", () => {
    expect(pluralizar("fatia", 2)).toBe("fatias");
    expect(pluralizar("unidade", 3)).toBe("unidades");
  });
  it("não pluraliza expressões compostas (evita 'colher de sopas')", () => {
    expect(pluralizar("colher de sopa", 2)).toBe("colher de sopa");
  });
});

describe("formatarRegistro", () => {
  it("mostra a medida escolhida com o resolvido entre parênteses", () => {
    expect(formatarRegistro(entry(), food, fatia)).toBe("2 fatias (50 g)");
  });
  it("cai para a base quando não há medida", () => {
    const e = entry({ measure_id: null, measure_count: null, qty_g: 150 });
    expect(formatarRegistro(e, food, null)).toBe("150 g");
  });
  it("cai para a base quando a medida foi apagada (measure indefinida)", () => {
    expect(formatarRegistro(entry(), food, undefined)).toBe("50 g");
  });
});
