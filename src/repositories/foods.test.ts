import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  searchFoods, getFoodsByIds, createFood, updateFood, deleteFood, listCustomFoods,
} from "./foods";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

const base = { nome: "Whey", marca: "X", base_qty_g: 30, kcal: 120, prot_g: 24, carb_g: 3, gord_g: 1.5 };

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
