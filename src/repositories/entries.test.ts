import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { listEntriesByDate, listEntriesByRange, createEntry, deleteEntry, updateEntry } from "./entries";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  // alimento global (FK food_id)
  await db.execute(
    "INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at) " +
    "VALUES ('Arroz', 'taco', 100, 130, 2.5, 28, 0.2, 't')",
  );
});

const novo = (over = {}) => ({
  data: "2026-07-07", meal_id: null, food_id: 1, qty_g: 100,
  measure_id: null, measure_count: null, label: null, ...over,
});

describe("entries repo", () => {
  it("cria e lista por data e usuário", async () => {
    await createEntry(db, 1, novo());
    const r = await listEntriesByDate(db, 1, "2026-07-07");
    expect(r).toHaveLength(1);
    expect(r[0].qty_g).toBe(100);
  });

  it("isola por usuário", async () => {
    await createEntry(db, 1, novo({ qty_g: 100 }));
    await createEntry(db, 2, novo({ qty_g: 200 }));
    expect(await listEntriesByDate(db, 1, "2026-07-07")).toHaveLength(1);
    expect((await listEntriesByDate(db, 1, "2026-07-07"))[0].qty_g).toBe(100);
    expect((await listEntriesByDate(db, 2, "2026-07-07"))[0].qty_g).toBe(200);
  });

  it("delete não afeta linha de outro usuário", async () => {
    const e = await createEntry(db, 1, novo());
    await deleteEntry(db, 2, e.id); // usuário 2 tenta apagar do 1
    expect(await listEntriesByDate(db, 1, "2026-07-07")).toHaveLength(1);
    await deleteEntry(db, 1, e.id);
    expect(await listEntriesByDate(db, 1, "2026-07-07")).toHaveLength(0);
  });

  it("listEntriesByRange retorna só o range e só do usuário", async () => {
    const base = { meal_id: null, food_id: 1, qty_g: 100, measure_id: null, measure_count: null, label: null };
    await createEntry(db, 1, { data: "2026-07-05", ...base }); // fora (antes)
    await createEntry(db, 1, { data: "2026-07-06", ...base }); // limite início
    await createEntry(db, 1, { data: "2026-07-09", ...base }); // dentro
    await createEntry(db, 1, { data: "2026-07-12", ...base }); // limite fim
    await createEntry(db, 1, { data: "2026-07-13", ...base }); // fora (depois)
    await createEntry(db, 2, { data: "2026-07-09", ...base }); // outro usuário

    const r = await listEntriesByRange(db, 1, "2026-07-06", "2026-07-12");
    expect(r.map((e) => e.data)).toEqual(["2026-07-06", "2026-07-09", "2026-07-12"]);
  });

  it("updateEntry altera qty_g e meal_id só da linha", async () => {
    // seed a meal for user 1
    await db.execute(
      "INSERT INTO meals (user_id, nome, ordem) VALUES (1, 'Almoço', 2)"
    );
    const mealId = 1;

    const e = await createEntry(db, 1, novo({ qty_g: 100, meal_id: null }));
    await updateEntry(db, 1, e.id, { qty_g: 250, meal_id: mealId });

    const updated = (await listEntriesByDate(db, 1, "2026-07-07"))[0];
    expect(updated.qty_g).toBe(250);
    expect(updated.meal_id).toBe(mealId);
  });

  it("updateEntry não afeta linha de outro usuário", async () => {
    const e = await createEntry(db, 1, novo({ qty_g: 100 }));
    await updateEntry(db, 2, e.id, { qty_g: 999 }); // usuário 2 tenta editar do 1
    expect((await listEntriesByDate(db, 1, "2026-07-07"))[0].qty_g).toBe(100);
  });
});
