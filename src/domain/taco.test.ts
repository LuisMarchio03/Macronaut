import { describe, it, expect } from "vitest";
import { normalizar, buscarTaco, type TacoItem } from "./taco";

const fixture: TacoItem[] = [
  { nome: "Arroz, integral, cozido", base_qty_g: 100, kcal: 124, prot_g: 2.6, carb_g: 25.8, gord_g: 1.0 },
  { nome: "Feijão, carioca, cozido", base_qty_g: 100, kcal: 76, prot_g: 4.8, carb_g: 13.6, gord_g: 0.5 },
  { nome: "Frango, peito, grelhado", base_qty_g: 100, kcal: 159, prot_g: 32, carb_g: 0, gord_g: 2.5 },
];

describe("normalizar", () => {
  it("remove acentos e caixa e apara espaços", () => {
    expect(normalizar("Feijão")).toBe("feijao");
    expect(normalizar("  ARROZ  ")).toBe("arroz");
  });
});

describe("buscarTaco", () => {
  it("acha sem acento e case-insensitive", () => {
    const r = buscarTaco(fixture, "feijao");
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("Feijão, carioca, cozido");
  });
  it("match por substring", () => {
    expect(buscarTaco(fixture, "grelhado")[0].nome).toBe("Frango, peito, grelhado");
  });
  it("termo vazio retorna []", () => {
    expect(buscarTaco(fixture, "   ")).toEqual([]);
  });
  it("respeita o limite", () => {
    expect(buscarTaco(fixture, "o", 2)).toHaveLength(2);
  });
  it("ordena por nome (ascendente)", () => {
    const desordenado: TacoItem[] = [
      { nome: "Frango, peito, grelhado", base_qty_g: 100, kcal: 159, prot_g: 32, carb_g: 0, gord_g: 2.5 },
      { nome: "Arroz, integral, cozido", base_qty_g: 100, kcal: 124, prot_g: 2.6, carb_g: 25.8, gord_g: 1.0 },
      { nome: "Banana, prata", base_qty_g: 100, kcal: 98, prot_g: 1.3, carb_g: 26, gord_g: 0.1 },
    ];
    expect(buscarTaco(desordenado, "a").map((f) => f.nome)).toEqual([
      "Arroz, integral, cozido",
      "Banana, prata",
      "Frango, peito, grelhado",
    ]);
  });
});
