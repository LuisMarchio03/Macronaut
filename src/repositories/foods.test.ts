import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  searchFoods, getFoodsByIds, createFood, updateFood, deleteFood, listCustomFoods,
  backfillNomeNorm,
} from "./foods";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

const base = {
  nome: "Whey", marca: "X", base_qty_g: 30, base_unit: "g" as const, default_measure_id: null,
  kcal: 120, prot_g: 24, carb_g: 3, gord_g: 1.5, fibra_g: null, sodio_mg: null, categoria: null,
};

it("cria alimento custom e busca por nome (case-insensitive)", async () => {
  const criado = await createFood(db, base);
  expect(criado.id).toBeGreaterThan(0);
  expect(criado.source).toBe("custom");
  const achados = await searchFoods(db, "whey");
  expect(achados).toHaveLength(1);
  expect(achados[0].nome).toBe("Whey");
});

it("getFoodsByIds devolve um mapa id→food", async () => {
  const a = await createFood(db, base);
  const map = await getFoodsByIds(db, [a.id, 9999]);
  expect(map.get(a.id)?.nome).toBe("Whey");
  expect(map.has(9999)).toBe(false);
});

it("atualiza e deleta", async () => {
  const a = await createFood(db, base);
  await updateFood(db, a.id, { ...base, nome: "Whey Iso" });
  expect((await searchFoods(db, "iso"))[0].nome).toBe("Whey Iso");
  await deleteFood(db, a.id);
  expect(await searchFoods(db, "whey")).toHaveLength(0);
});

it("listCustomFoods traz só os custom", async () => {
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz', 'taco', 100, 128, 2.5, 28, 0.2, ?)`,
    args: [new Date().toISOString()],
  });
  await createFood(db, base);
  const custom = await listCustomFoods(db);
  expect(custom).toHaveLength(1);
  expect(custom[0].source).toBe("custom");
});

it("persiste base_unit — o alimento não nasce mais sempre em grama", async () => {
  const ovo = await createFood(db, {
    ...base, nome: "Ovo", base_qty_g: 1, base_unit: "un", kcal: 70,
  });
  const lido = (await getFoodsByIds(db, [ovo.id])).get(ovo.id);
  expect(lido?.base_unit).toBe("un");
});

it("persiste ml como base_unit", async () => {
  const leite = await createFood(db, {
    ...base, nome: "Leite", base_qty_g: 100, base_unit: "ml", kcal: 60,
  });
  expect((await getFoodsByIds(db, [leite.id])).get(leite.id)?.base_unit).toBe("ml");
});

it("persiste fibra, sódio e categoria", async () => {
  const f = await createFood(db, {
    ...base, nome: "Aveia", fibra_g: 9.1, sodio_mg: 5, categoria: "Cereais e derivados",
  });
  const lido = (await getFoodsByIds(db, [f.id])).get(f.id);
  expect(lido?.fibra_g).toBe(9.1);
  expect(lido?.sodio_mg).toBe(5);
  expect(lido?.categoria).toBe("Cereais e derivados");
});

it("updateFood altera base_unit e default_measure_id", async () => {
  const f = await createFood(db, { ...base, nome: "Pão" });
  await db.execute({
    sql: "INSERT INTO food_measures (food_id, nome, qty_base, ordem) VALUES (?, 'fatia', 25, 0)",
    args: [f.id],
  });
  const medidaId = Number(
    (await db.execute("SELECT id FROM food_measures WHERE nome='fatia'")).rows[0].id,
  );
  await updateFood(db, f.id, { ...base, nome: "Pão", base_unit: "g", default_measure_id: medidaId });
  const lido = (await getFoodsByIds(db, [f.id])).get(f.id);
  expect(lido?.default_measure_id).toBe(medidaId);
});

it("alimento antigo sem nutrientes continua legível (retrocompat)", async () => {
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Legado', 'taco', 100, 100, 5, 10, 2, ?)`,
    args: [new Date().toISOString()],
  });
  const achados = await searchFoods(db, "Legado");
  expect(achados[0].fibra_g).toBeNull();
  expect(achados[0].base_unit).toBe("g"); // DEFAULT da coluna aditiva
});

/* ══ busca sem acento ═════════════════════════════════════════════════════
   `LIKE ... COLLATE NOCASE` do SQLite só é insensível a caixa em ASCII: não
   casa "acucar" com "Açúcar", nem sequer "AÇÚCAR" com "açúcar". Numa base de
   590 alimentos com nome vindo da TACO — cheio de acento e em caixa alta —
   isso significa não achar o alimento e cadastrar de novo o que já existe. */

it("acha o alimento sem digitar o acento", async () => {
  await createFood(db, { ...base, nome: "Açúcar mascavo" });
  expect((await searchFoods(db, "acucar")).map((f) => f.nome)).toEqual(["Açúcar mascavo"]);
  expect((await searchFoods(db, "AÇÚCAR")).map((f) => f.nome)).toEqual(["Açúcar mascavo"]);
  expect((await searchFoods(db, "mascavo")).map((f) => f.nome)).toEqual(["Açúcar mascavo"]);
});

it("renomear mantém a busca sem acento coerente", async () => {
  const a = await createFood(db, { ...base, nome: "Whey" });
  await updateFood(db, a.id, { ...base, nome: "Proteína isolada" });
  expect((await searchFoods(db, "proteina")).map((f) => f.nome)).toEqual(["Proteína isolada"]);
  expect(await searchFoods(db, "whey")).toHaveLength(0);
});

/** Linha gravada antes da coluna existir continua encontrável pelo nome cru. */
it("alimento sem nome normalizado ainda é achado pelo nome", async () => {
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, base_unit, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz integral', 'taco', 100, 'g', 124, 2.6, 25.8, 1, ?)`,
    args: [new Date().toISOString()],
  });
  expect((await searchFoods(db, "arroz")).map((f) => f.nome)).toEqual(["Arroz integral"]);
});

it("o backfill normaliza o que já estava no banco", async () => {
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, base_unit, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Feijão carioca', 'taco', 100, 'g', 76, 4.8, 13.6, 0.5, ?)`,
    args: [new Date().toISOString()],
  });
  expect(await backfillNomeNorm(db)).toBe(1);
  expect((await searchFoods(db, "feijao")).map((f) => f.nome)).toEqual(["Feijão carioca"]);
  // Idempotente: rodar de novo não mexe em nada.
  expect(await backfillNomeNorm(db)).toBe(0);
});
