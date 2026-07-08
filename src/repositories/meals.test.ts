import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { listMeals, createMeal, updateMeal, deleteMeal, seedDefaultMeals } from "./meals";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

describe("meals repo", () => {
  it("seed por usuário e idempotente", async () => {
    await seedDefaultMeals(db, 1);
    await seedDefaultMeals(db, 1);
    expect((await listMeals(db, 1)).length).toBe(5);
    expect(await listMeals(db, 2)).toHaveLength(0);
  });

  it("isola refeições por usuário", async () => {
    await createMeal(db, 1, { nome: "Lanche", horario: "10:00", ordem: 1 });
    await createMeal(db, 2, { nome: "Brunch", horario: "11:00", ordem: 1 });
    const doUm = await listMeals(db, 1);
    expect(doUm).toHaveLength(1);
    expect(doUm[0].nome).toBe("Lanche");
  });

  it("update/delete não afetam outro usuário", async () => {
    const m1 = await createMeal(db, 1, { nome: "Lanche", horario: "10:00", ordem: 1 });
    await updateMeal(db, 2, m1.id, { nome: "Hack", horario: "00:00", ordem: 9 });
    expect((await listMeals(db, 1))[0].nome).toBe("Lanche"); // intacto
    await deleteMeal(db, 2, m1.id);
    expect(await listMeals(db, 1)).toHaveLength(1);
    await deleteMeal(db, 1, m1.id);
    expect(await listMeals(db, 1)).toHaveLength(0);
  });
});
