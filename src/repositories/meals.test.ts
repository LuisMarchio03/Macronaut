import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  listMeals, createMeal, updateMeal, deleteMeal, reordenarMeals, seedDefaultMeals,
} from "./meals";

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

describe("reordenarMeals", () => {
  it("põe as refeições na ordem pedida", async () => {
    const cafe = await createMeal(db, 1, { nome: "Café", horario: "07:00", ordem: 1 });
    const almoco = await createMeal(db, 1, { nome: "Almoço", horario: "12:00", ordem: 2 });

    await reordenarMeals(db, 1, [almoco.id, cafe.id]);

    expect((await listMeals(db, 1)).map((m) => m.nome)).toEqual(["Almoço", "Café"]);
  });

  it("numera a ordem de 1 em diante, sem buracos", async () => {
    const a = await createMeal(db, 1, { nome: "A", horario: null, ordem: 7 });
    const b = await createMeal(db, 1, { nome: "B", horario: null, ordem: 40 });

    await reordenarMeals(db, 1, [b.id, a.id]);

    expect((await listMeals(db, 1)).map((m) => m.ordem)).toEqual([1, 2]);
  });

  // A tela manda a ordem que conhece. Uma lista incompleta não pode fazer
  // refeição sumir da lista nem empilhar duas na mesma posição.
  it("refeição de fora da lista vai para o fim, sem sumir", async () => {
    const a = await createMeal(db, 1, { nome: "A", horario: "07:00", ordem: 1 });
    const b = await createMeal(db, 1, { nome: "B", horario: "12:00", ordem: 2 });
    await createMeal(db, 1, { nome: "C", horario: "20:00", ordem: 3 });

    await reordenarMeals(db, 1, [b.id, a.id]);

    expect((await listMeals(db, 1)).map((m) => m.nome)).toEqual(["B", "A", "C"]);
  });

  it("um usuário não reordena as refeições do outro", async () => {
    const cafe = await createMeal(db, 1, { nome: "Café", horario: "07:00", ordem: 1 });
    const almoco = await createMeal(db, 1, { nome: "Almoço", horario: "12:00", ordem: 2 });

    await reordenarMeals(db, 2, [almoco.id, cafe.id]);

    expect((await listMeals(db, 1)).map((m) => m.nome)).toEqual(["Café", "Almoço"]);
  });
});
