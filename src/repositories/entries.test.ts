import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { listEntriesByDate, createEntry, deleteEntry } from "./entries";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  // alimento global (FK food_id)
  await db.execute(
    "INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at) " +
    "VALUES ('Arroz', 'taco', 100, 130, 2.5, 28, 0.2, 't')",
  );
});

const novo = (over = {}) => ({ data: "2026-07-07", meal_id: null, food_id: 1, qty_g: 100, label: null, ...over });

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
});
