import { it, expect } from "vitest";
import { GRUPOS, CATALOGO } from "./catalogo-exercicios";

it("tem os 12 grupos, com cadeia NULL nos inferiores e no core", () => {
  expect(GRUPOS).toHaveLength(12);
  for (const g of GRUPOS) {
    if (g.regiao !== "superior") expect(g.cadeia).toBeNull();
  }
  expect(GRUPOS.filter((g) => g.regiao === "superior")).toHaveLength(7);
});

it("não tem grupo repetido", () => {
  expect(new Set(GRUPOS.map((g) => g.nome)).size).toBe(GRUPOS.length);
});

it("todo exercício aponta para um grupo que existe", () => {
  const nomes = new Set(GRUPOS.map((g) => g.nome));
  for (const e of CATALOGO) expect(nomes).toContain(e.grupo);
});

it("não tem exercício de nome repetido", () => {
  expect(new Set(CATALOGO.map((e) => e.nome)).size).toBe(CATALOGO.length);
});

it("cobre todos os 12 grupos e tem tamanho de catálogo", () => {
  expect(CATALOGO.length).toBeGreaterThanOrEqual(70);
  const cobertos = new Set(CATALOGO.map((e) => e.grupo));
  for (const g of GRUPOS) expect(cobertos).toContain(g.nome);
});
