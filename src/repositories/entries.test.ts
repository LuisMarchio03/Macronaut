import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { listEntriesByDate, createEntry, deleteEntry } from "./entries";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz', 'taco', 100, 128, 2.5, 28, 0.2, ?)`,
    args: [new Date().toISOString()],
  });
});

it("cria entry e lista por data", async () => {
  const e = await createEntry(db, { data: "2026-07-06", meal_id: null, food_id: 1, qty_g: 150, label: "Extra" });
  expect(e.id).toBeGreaterThan(0);
  const doDia = await listEntriesByDate(db, "2026-07-06");
  expect(doDia).toHaveLength(1);
  expect(doDia[0].qty_g).toBe(150);
  expect(doDia[0].meal_id).toBeNull();
});

it("filtra por data", async () => {
  await createEntry(db, { data: "2026-07-06", meal_id: null, food_id: 1, qty_g: 100, label: null });
  await createEntry(db, { data: "2026-07-05", meal_id: null, food_id: 1, qty_g: 100, label: null });
  expect(await listEntriesByDate(db, "2026-07-06")).toHaveLength(1);
});

it("deleta entry", async () => {
  const e = await createEntry(db, { data: "2026-07-06", meal_id: null, food_id: 1, qty_g: 100, label: null });
  await deleteEntry(db, e.id);
  expect(await listEntriesByDate(db, "2026-07-06")).toHaveLength(0);
});
