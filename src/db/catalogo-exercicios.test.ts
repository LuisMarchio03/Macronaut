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

/* ══ a ficha do catálogo ══════════════════════════════════════════════════
   Ela é conteúdo nosso, versionado no código, e o seed a reescreve a cada
   `db:setup`. Um erro aqui é um erro em produção sem passar por revisão de
   dado nenhuma — por isso as invariantes moram em teste. */

it("todo exercício tem instruções de execução", () => {
  const sem = CATALOGO.filter((e) => !e.instrucoes || e.instrucoes.length === 0);
  expect(sem.map((e) => e.nome)).toEqual([]);
});

it("nenhum exercício se lista como próprio músculo secundário", () => {
  const errados = CATALOGO.filter((e) => e.secundarios?.includes(e.grupo));
  expect(errados.map((e) => e.nome)).toEqual([]);
});

it("secundário não repete dentro do mesmo exercício", () => {
  for (const e of CATALOGO) {
    if (!e.secundarios) continue;
    expect(new Set(e.secundarios).size).toBe(e.secundarios.length);
  }
});

/**
 * O apelido é a chave da busca. Um apelido que é substring do próprio nome
 * não acrescenta nada (a busca por nome já acha), e um apelido repetido entre
 * dois exercícios faz a busca devolver os dois para um termo que deveria ser
 * de um só — nenhum dos dois quebra, mas os dois são ruído para manter.
 */
it("apelido não repete entre exercícios", () => {
  const visto = new Map<string, string>();
  const colisoes: string[] = [];
  for (const e of CATALOGO) {
    for (const a of e.aliases ?? []) {
      const anterior = visto.get(a);
      if (anterior) colisoes.push(`"${a}": ${anterior} × ${e.nome}`);
      else visto.set(a, e.nome);
    }
  }
  expect(colisoes).toEqual([]);
});

it("é um catálogo de verdade, não uma amostra", () => {
  expect(CATALOGO.length).toBeGreaterThanOrEqual(150);
  // Todo grupo tem pelo menos três opções — um grupo com uma só não dá rotina.
  for (const g of GRUPOS) {
    expect(CATALOGO.filter((e) => e.grupo === g.nome).length).toBeGreaterThanOrEqual(3);
  }
});
