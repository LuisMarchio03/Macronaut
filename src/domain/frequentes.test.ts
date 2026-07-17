import { it, expect } from "vitest";
import { frequentesDaRefeicao, recentes, ultimaRefeicao } from "./frequentes";
import type { FoodEntry } from "./types";

let seq = 0;
const e = (over: Partial<FoodEntry>): FoodEntry => ({
  id: ++seq, data: "2026-07-15", meal_id: 1, food_id: 1, qty_g: 50,
  measure_id: 7, measure_count: 2, label: null, created_at: `2026-07-15T07:0${seq}:00Z`,
  ...over,
});

it("ranqueia por número de vezes na refeição", () => {
  const r = frequentesDaRefeicao([
    e({ food_id: 1, data: "2026-07-14" }),
    e({ food_id: 1, data: "2026-07-15" }),
    e({ food_id: 1, data: "2026-07-16" }),
    e({ food_id: 2, data: "2026-07-16" }),
  ], 1);
  expect(r.map((x) => x.food_id)).toEqual([1, 2]);
  expect(r[0].vezes).toBe(3);
});

it("filtra pela refeição pedida", () => {
  const r = frequentesDaRefeicao([
    e({ food_id: 1, meal_id: 1 }),
    e({ food_id: 2, meal_id: 2 }),
  ], 1);
  expect(r.map((x) => x.food_id)).toEqual([1]);
});

it("traz a medida do uso MAIS RECENTE, não a do mais antigo", () => {
  const r = frequentesDaRefeicao([
    e({ food_id: 1, data: "2026-07-14", measure_count: 1, qty_g: 25 }),
    e({ food_id: 1, data: "2026-07-16", measure_count: 3, qty_g: 75 }),
  ], 1);
  expect(r[0].measure_count).toBe(3);
  expect(r[0].qty_g).toBe(75);
});

// Desempate no MESMO DIA: usuário edita a quantidade duas vezes na mesma data.
// A porção vem do created_at mais tardio, não da ordem no array. Sem isto,
// inverter o `>=` em maisRecente passaria despercebido.
it("mesma data: a porção vem do created_at mais recente, não da ordem do array", () => {
  const cedo: FoodEntry = {
    id: 1, data: "2026-07-15", meal_id: 1, food_id: 1, qty_g: 25,
    measure_id: 7, measure_count: 1, label: null, created_at: "2026-07-15T07:00:00Z",
  };
  const tarde: FoodEntry = { ...cedo, id: 2, qty_g: 75, measure_count: 3, created_at: "2026-07-15T20:00:00Z" };
  // array em ordem "tarde antes de cedo" para provar que não é a posição que decide:
  const r = frequentesDaRefeicao([tarde, cedo], 1);
  expect(r[0].measure_count).toBe(3);
  expect(r[0].qty_g).toBe(75);
  // e o inverso: com cedo depois no array, ainda vence o tarde
  const r2 = frequentesDaRefeicao([cedo, tarde], 1);
  expect(r2[0].measure_count).toBe(3);
});

it("recentes desempata por created_at dentro do mesmo dia", () => {
  const antigo: FoodEntry = {
    id: 1, data: "2026-07-15", meal_id: 1, food_id: 1, qty_g: 25,
    measure_id: 7, measure_count: 1, label: null, created_at: "2026-07-15T07:00:00Z",
  };
  const novo: FoodEntry = { ...antigo, id: 2, qty_g: 75, measure_count: 3, created_at: "2026-07-15T20:00:00Z" };
  const r = recentes([antigo, novo]);
  expect(r[0].qty_g).toBe(75);
});

it("respeita o limite", () => {
  const r = frequentesDaRefeicao(
    [1, 2, 3, 4, 5].map((food_id) => e({ food_id })), 1, 3,
  );
  expect(r).toHaveLength(3);
});

it("refeição avulsa (meal_id null) é filtrável", () => {
  const r = frequentesDaRefeicao([
    e({ food_id: 1, meal_id: null }),
    e({ food_id: 2, meal_id: 1 }),
  ], null);
  expect(r.map((x) => x.food_id)).toEqual([1]);
});

it("recentes ordena por data desc e não repete alimento", () => {
  const r = recentes([
    e({ food_id: 1, data: "2026-07-10" }),
    e({ food_id: 2, data: "2026-07-16" }),
    e({ food_id: 2, data: "2026-07-15" }),
  ]);
  expect(r.map((x) => x.food_id)).toEqual([2, 1]);
});

it("ultimaRefeicao pega a última data COM registro, não 'ontem'", () => {
  // Pulou 16/07: a última real é 14/07.
  const r = ultimaRefeicao([
    e({ food_id: 1, data: "2026-07-14" }),
    e({ food_id: 2, data: "2026-07-14" }),
    e({ food_id: 3, data: "2026-07-10" }),
  ], 1);
  expect(r?.data).toBe("2026-07-14");
  expect(r?.itens).toHaveLength(2);
});

it("ultimaRefeicao devolve null sem histórico", () => {
  expect(ultimaRefeicao([], 1)).toBeNull();
});

it("ultimaRefeicao ignora outras refeições", () => {
  const r = ultimaRefeicao([
    e({ food_id: 1, meal_id: 2, data: "2026-07-16" }),
    e({ food_id: 2, meal_id: 1, data: "2026-07-14" }),
  ], 1);
  expect(r?.data).toBe("2026-07-14");
});
