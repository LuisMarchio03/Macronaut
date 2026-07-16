import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { seedMuscleGroups, listMuscleGroups } from "./muscle-groups";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

it("semeia os 12 grupos", async () => {
  await seedMuscleGroups(db);
  const gs = await listMuscleGroups(db);
  expect(gs).toHaveLength(12);
  expect(gs.find((g) => g.nome === "Peito")).toMatchObject({ regiao: "superior", cadeia: "push" });
  expect(gs.find((g) => g.nome === "Quadríceps")).toMatchObject({ regiao: "inferior", cadeia: null });
});

it("semear duas vezes é idempotente", async () => {
  await seedMuscleGroups(db);
  await seedMuscleGroups(db);
  expect(await listMuscleGroups(db)).toHaveLength(12);
});

it("semear duas vezes preserva os ids e propaga regiao/cadeia atualizados — não é INSERT OR REPLACE", async () => {
  await seedMuscleGroups(db);
  const antes = await listMuscleGroups(db);
  expect(antes).toHaveLength(12);

  // Simula grupo desatualizado no banco do usuário (ex.: uma correção futura de
  // catálogo). `OR REPLACE` "corrigiria" isso também, mas via DELETE+INSERT —
  // rowid novo. `exercises.grupo_id` aponta para este id, então um rowid novo
  // deixaria exercícios órfãos silenciosamente.
  await db.execute("UPDATE muscle_groups SET regiao='inferior', cadeia='pull' WHERE nome='Peito'");

  await seedMuscleGroups(db);
  const depois = await listMuscleGroups(db);
  expect(depois).toHaveLength(12);

  // (a) ids idênticos, na mesma ordem — nenhum grupo foi recriado.
  expect(depois.map((g) => g.id)).toEqual(antes.map((g) => g.id));

  // (b) regiao/cadeia voltam a refletir o catálogo — o seed corrige, não ignora.
  expect(depois.find((g) => g.nome === "Peito")).toMatchObject({
    regiao: "superior",
    cadeia: "push",
  });
});
