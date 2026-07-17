import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  listMeasures, listMeasuresByFoodIds, createMeasure, updateMeasure, deleteMeasure,
  temCandidatas, listCandidatos, resolverCandidatas,
} from "./food-measures";

let db: Client;
let foodId: number;

beforeEach(async () => {
  db = await createTestDb();
  const rs = await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Feijão', 'taco', 100, 76, 4.8, 13.6, 0.5, ?)`,
    args: [new Date().toISOString()],
  });
  foodId = Number(rs.lastInsertRowid);
});

const medida = (over: Partial<Parameters<typeof createMeasure>[1]> = {}) => ({
  food_id: foodId, nome: "fatia", qty_base: 25, ordem: 0,
  source: "manual" as const, status: "confirmada" as const, pof_codigo: null, pof_descricao: null,
  ...over,
});

it("cria e lista medidas por ordem", async () => {
  await createMeasure(db, medida({ nome: "concha", qty_base: 140, ordem: 1 }));
  await createMeasure(db, medida({ nome: "colher", qty_base: 25, ordem: 0 }));
  const lista = await listMeasures(db, foodId);
  expect(lista.map((m) => m.nome)).toEqual(["colher", "concha"]);
  expect(lista[1].qty_base).toBe(140);
});

it("listMeasures esconde as descartadas", async () => {
  await createMeasure(db, medida({ nome: "concha" }));
  await createMeasure(db, medida({ nome: "prato", status: "descartada" }));
  const lista = await listMeasures(db, foodId);
  expect(lista.map((m) => m.nome)).toEqual(["concha"]);
});

it("listMeasuresByFoodIds agrupa por alimento", async () => {
  await createMeasure(db, medida({ nome: "concha" }));
  const mapa = await listMeasuresByFoodIds(db, [foodId, 9999]);
  expect(mapa.get(foodId)).toHaveLength(1);
  expect(mapa.has(9999)).toBe(false);
});

it("atualiza nome e qty_base", async () => {
  const m = await createMeasure(db, medida());
  await updateMeasure(db, m.id, { qty_base: 28 });
  expect((await listMeasures(db, foodId))[0].qty_base).toBe(28);
});

it("deleta só medida manual — a da POF é protegida", async () => {
  const manual = await createMeasure(db, medida({ nome: "minha" }));
  const daPof = await createMeasure(db, medida({ nome: "concha", source: "pof", pof_codigo: "201" }));
  await deleteMeasure(db, manual.id);
  await deleteMeasure(db, daPof.id);
  expect((await listMeasures(db, foodId)).map((m) => m.nome)).toEqual(["concha"]);
});

it("temCandidatas detecta ambiguidade pendente", async () => {
  expect(await temCandidatas(db, foodId)).toBe(false);
  await createMeasure(db, medida({ nome: "concha", source: "pof", status: "candidata", pof_codigo: "201" }));
  expect(await temCandidatas(db, foodId)).toBe(true);
});

it("listCandidatos agrupa por código POF", async () => {
  await createMeasure(db, medida({ nome: "concha", source: "pof", status: "candidata", pof_codigo: "201" }));
  await createMeasure(db, medida({ nome: "prato", source: "pof", status: "candidata", pof_codigo: "201", ordem: 1 }));
  await createMeasure(db, medida({ nome: "colher", source: "pof", status: "candidata", pof_codigo: "202", ordem: 2 }));
  const cands = await listCandidatos(db, foodId);
  expect(cands).toHaveLength(2);
  expect(cands[0].pof_codigo).toBe("201");
  expect(cands[0].medidas).toHaveLength(2);
  expect(cands[1].medidas.map((m) => m.nome)).toEqual(["colher"]);
});

// pof_descricao percorre createMeasure -> banco -> listCandidatos sem sumir.
// (Regressão: o INSERT de createMeasure já omitiu essa coluna uma vez, gravando
// NULL enquanto o retorno em memória mentia a descrição.)
it("pof_descricao é gravada e volta em listCandidatos", async () => {
  const criada = await createMeasure(db, medida({
    nome: "concha", source: "pof", status: "candidata",
    pof_codigo: "201", pof_descricao: "FEIJAO CARIOCA · CROZIDO(A)",
  }));
  // O objeto retornado bate com o que foi persistido (não um fantasma):
  expect(criada.pof_descricao).toBe("FEIJAO CARIOCA · CROZIDO(A)");
  const relido = await db.execute({
    sql: "SELECT pof_descricao FROM food_measures WHERE id=?",
    args: [criada.id],
  });
  expect(relido.rows[0].pof_descricao).toBe("FEIJAO CARIOCA · CROZIDO(A)");
  const cands = await listCandidatos(db, foodId);
  expect(cands[0].pof_descricao).toBe("FEIJAO CARIOCA · CROZIDO(A)");
});

it("resolverCandidatas confirma o escolhido e DESCARTA os demais — sem deletar", async () => {
  await createMeasure(db, medida({ nome: "concha", source: "pof", status: "candidata", pof_codigo: "201" }));
  await createMeasure(db, medida({ nome: "colher", source: "pof", status: "candidata", pof_codigo: "202", ordem: 1 }));

  await resolverCandidatas(db, foodId, "201");

  const todas = await db.execute({
    sql: "SELECT nome, status FROM food_measures WHERE food_id=? ORDER BY nome",
    args: [foodId],
  });
  // Item 4 do spec: nada é deletado. As duas linhas continuam lá.
  expect(todas.rows).toHaveLength(2);
  expect(todas.rows.find((r) => r.nome === "concha")?.status).toBe("confirmada");
  expect(todas.rows.find((r) => r.nome === "colher")?.status).toBe("descartada");
  // Mas só a confirmada aparece na UI.
  expect((await listMeasures(db, foodId)).map((m) => m.nome)).toEqual(["concha"]);
});

it("resolverCandidatas com null descarta todas ('nenhum destes')", async () => {
  await createMeasure(db, medida({ nome: "concha", source: "pof", status: "candidata", pof_codigo: "201" }));
  await resolverCandidatas(db, foodId, null);
  expect(await listMeasures(db, foodId)).toHaveLength(0);
  expect(await temCandidatas(db, foodId)).toBe(false);
  const rs = await db.execute({ sql: "SELECT COUNT(*) AS n FROM food_measures WHERE food_id=?", args: [foodId] });
  expect(rs.rows[0].n).toBe(1); // ainda no banco, só descartada
});

it("resolverCandidatas não mexe em medida manual do usuário", async () => {
  await createMeasure(db, medida({ nome: "minha" }));
  await createMeasure(db, medida({ nome: "concha", source: "pof", status: "candidata", pof_codigo: "201", ordem: 1 }));
  await resolverCandidatas(db, foodId, null);
  expect((await listMeasures(db, foodId)).map((m) => m.nome)).toEqual(["minha"]);
});

// "Mudar de ideia" não pode ressuscitar uma medida já descartada: uma 2ª
// resolução com escolha diferente é no-op, porque não há mais 'candidata'.
// Sem o filtro `status='candidata'` na confirmação, a 2ª chamada re-confirmaria
// o candidato 201 e o alimento ficaria com DOIS confirmados.
it("resolverCandidatas é idempotente e não reabre uma escolha já feita", async () => {
  await createMeasure(db, medida({ nome: "concha", source: "pof", status: "candidata", pof_codigo: "201" }));
  await createMeasure(db, medida({ nome: "colher", source: "pof", status: "candidata", pof_codigo: "202", ordem: 1 }));

  await resolverCandidatas(db, foodId, "202"); // escolhe o 202
  await resolverCandidatas(db, foodId, "201"); // "muda de ideia" — deve ser no-op

  const rs = await db.execute({
    sql: "SELECT nome, status FROM food_measures WHERE food_id=? ORDER BY nome",
    args: [foodId],
  });
  expect(rs.rows.find((r) => r.nome === "colher")?.status).toBe("confirmada"); // 202 continua o escolhido
  expect(rs.rows.find((r) => r.nome === "concha")?.status).toBe("descartada"); // 201 NÃO ressuscitou
  expect((await listMeasures(db, foodId)).map((m) => m.nome)).toEqual(["colher"]);
});
