import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { listMeals, createMeal, updateMeal, deleteMeal, seedDefaultMeals } from "./meals";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

it("seedDefaultMeals cria 5 refeições ordenadas e é idempotente", async () => {
  await seedDefaultMeals(db);
  await seedDefaultMeals(db);
  const meals = await listMeals(db);
  expect(meals).toHaveLength(5);
  expect(meals[0].nome).toBe("Café da manhã");
  expect(meals.map((m) => m.ordem)).toEqual([1, 2, 3, 4, 5]);
});

it("CRUD de refeição", async () => {
  const m = await createMeal(db, { nome: "Pré-treino", horario: "17:00", ordem: 6 });
  expect(m.id).toBeGreaterThan(0);
  await updateMeal(db, m.id, { nome: "Pré-treino", horario: "18:00", ordem: 6 });
  expect((await listMeals(db))[0].horario).toBe("18:00");
  await deleteMeal(db, m.id);
  expect(await listMeals(db)).toHaveLength(0);
});

it("deleteMeal não deixa food_entries órfãos: desvincula meal_id ao invés de contar com a FK", async () => {
  // Simula produção: o cliente web/HTTP do Turso não persiste FK enforcement,
  // então só o UPDATE explícito de deleteMeal (não a FK) deve anular o meal_id.
  await db.execute("PRAGMA foreign_keys = OFF");

  const food = await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz', 'taco', 100, 128, 2.5, 28, 0.2, ?)`,
    args: [new Date().toISOString()],
  });
  const foodId = Number(food.lastInsertRowid);
  const m = await createMeal(db, { nome: "Almoço", horario: "12:00", ordem: 1 });
  const entry = await db.execute({
    sql: `INSERT INTO food_entries (data, meal_id, food_id, qty_g, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: ["2026-07-06", m.id, foodId, 100, new Date().toISOString()],
  });
  const entryId = Number(entry.lastInsertRowid);

  await deleteMeal(db, m.id);

  expect(await listMeals(db)).toHaveLength(0);
  const rs = await db.execute({
    sql: "SELECT meal_id FROM food_entries WHERE id = ?",
    args: [entryId],
  });
  expect(rs.rows).toHaveLength(1);
  expect(rs.rows[0].meal_id).toBeNull();
});
