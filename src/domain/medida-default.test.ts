import { it, expect } from "vitest";
import { sugerirPorcao } from "./medida-default";
import type { Food, FoodMeasure } from "./types";

const pao: Food = {
  id: 1, nome: "Pão de forma", source: "taco", marca: null,
  base_qty_g: 100, base_unit: "g", default_measure_id: null,
  kcal: 250, prot_g: 8, carb_g: 48, gord_g: 3,
  fibra_g: null, sodio_mg: null, categoria: null, created_at: "",
};

const m = (over: Partial<FoodMeasure>): FoodMeasure => ({
  id: 1, food_id: 1, nome: "fatia", qty_base: 25, ordem: 0,
  source: "pof", status: "confirmada", pof_codigo: null, pof_descricao: null, ...over,
});

it("sem medidas: cai na base, 100 g", () => {
  const s = sugerirPorcao(pao, []);
  expect(s.measure).toBeNull();
  expect(s.qty_g).toBe(100);
});

it("com medida: 1 unidade dela, não 100 g", () => {
  const s = sugerirPorcao(pao, [m({ nome: "fatia", qty_base: 25 })]);
  expect(s.measure?.nome).toBe("fatia");
  expect(s.count).toBe(1);
  expect(s.qty_g).toBe(25);
});

it("respeita default_measure_id acima da ordem", () => {
  const food = { ...pao, default_measure_id: 2 };
  const s = sugerirPorcao(food, [
    m({ id: 1, nome: "fatia", qty_base: 25, ordem: 0 }),
    m({ id: 2, nome: "pacote", qty_base: 500, ordem: 1 }),
  ]);
  expect(s.measure?.nome).toBe("pacote");
  expect(s.qty_g).toBe(500);
});

it("sem default: usa a de menor ordem", () => {
  const s = sugerirPorcao(pao, [
    m({ id: 2, nome: "pacote", qty_base: 500, ordem: 1 }),
    m({ id: 1, nome: "fatia", qty_base: 25, ordem: 0 }),
  ]);
  expect(s.measure?.nome).toBe("fatia");
});

it("default_measure_id apontando pra medida sumida cai na de menor ordem", () => {
  const food = { ...pao, default_measure_id: 999 };
  const s = sugerirPorcao(food, [m({ id: 1, nome: "fatia", ordem: 0 })]);
  expect(s.measure?.nome).toBe("fatia");
});

it("base 'un' sem medidas sugere 1 unidade, não 100", () => {
  const ovo: Food = { ...pao, nome: "Ovo", base_qty_g: 1, base_unit: "un", kcal: 70 };
  const s = sugerirPorcao(ovo, []);
  expect(s.measure).toBeNull();
  expect(s.qty_g).toBe(1);
});

it("ignora medidas descartadas", () => {
  const s = sugerirPorcao(pao, [m({ nome: "fatia", status: "descartada" })]);
  expect(s.measure).toBeNull();
  expect(s.qty_g).toBe(100);
});

// Só 'confirmada' vira sugestão. Uma 'candidata' (alimento não desambiguado)
// escolhida por menor ordem seria escolha pela ordem do CSV do IBGE — cai na
// base até o usuário desambiguar.
it("ignora medidas candidatas (alimento não desambiguado)", () => {
  const s = sugerirPorcao(pao, [m({ nome: "fatia", status: "candidata" })]);
  expect(s.measure).toBeNull();
  expect(s.qty_g).toBe(100);
});
