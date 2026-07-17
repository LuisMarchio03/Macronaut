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
  // medidas globais (FK measure_id) — id sequencia 1-7
  for (let i = 1; i <= 7; i++) {
    await db.execute(
      "INSERT INTO food_measures (food_id, nome, qty_base, ordem) " +
      "VALUES (1, ?, ?, ?)",
      [i === 7 ? 'fatia' : `medida_${i}`, 25, i],
    );
  }
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

  it("persiste measure_id e measure_count — a intenção do usuário", async () => {
    const e = await createEntry(db, 1, {
      data: "2026-07-17", meal_id: null, food_id: 1, qty_g: 50,
      measure_id: 7, measure_count: 2, label: null,
    });
    const lidas = await listEntriesByDate(db, 1, "2026-07-17");
    const lida = lidas.find((x) => x.id === e.id);
    expect(lida?.measure_id).toBe(7);
    expect(lida?.measure_count).toBe(2);
    expect(lida?.qty_g).toBe(50); // grama continua sendo sempre gravada
  });

  it("aceita measure_count fracionário (meia fatia)", async () => {
    await createEntry(db, 1, {
      data: "2026-07-17", meal_id: null, food_id: 1, qty_g: 12.5,
      measure_id: 7, measure_count: 0.5, label: null,
    });
    const lidas = await listEntriesByDate(db, 1, "2026-07-17");
    expect(lidas[0].measure_count).toBe(0.5);
  });

  it("registro em grama pura tem measure nulo", async () => {
    await createEntry(db, 1, {
      data: "2026-07-17", meal_id: null, food_id: 1, qty_g: 30,
      measure_id: null, measure_count: null, label: null,
    });
    const lidas = await listEntriesByDate(db, 1, "2026-07-17");
    expect(lidas[0].measure_id).toBeNull();
  });

  it("updateEntry troca a medida junto com a quantidade", async () => {
    const e = await createEntry(db, 1, {
      data: "2026-07-17", meal_id: null, food_id: 1, qty_g: 50,
      measure_id: 7, measure_count: 2, label: null,
    });
    await updateEntry(db, 1, e.id, { qty_g: 75, measure_id: 7, measure_count: 3 });
    const lidas = await listEntriesByDate(db, 1, "2026-07-17");
    expect(lidas[0].qty_g).toBe(75);
    expect(lidas[0].measure_count).toBe(3);
  });

  it("updateEntry limpa a medida ao voltar pra grama pura", async () => {
    const e = await createEntry(db, 1, {
      data: "2026-07-17", meal_id: null, food_id: 1, qty_g: 50,
      measure_id: 7, measure_count: 2, label: null,
    });
    await updateEntry(db, 1, e.id, { qty_g: 33, measure_id: null, measure_count: null });
    const lidas = await listEntriesByDate(db, 1, "2026-07-17");
    expect(lidas[0].measure_id).toBeNull();
    expect(lidas[0].measure_count).toBeNull();
  });
});
