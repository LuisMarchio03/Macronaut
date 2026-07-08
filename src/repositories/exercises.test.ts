import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { listExercises, createExercise, updateExercise, deleteExercise } from "./exercises";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

it("cria, lista e atualiza exercício", async () => {
  const e = await createExercise(db, { nome: "Supino", grupo_muscular: "Peito" });
  expect(e.id).toBeGreaterThan(0);
  expect((await listExercises(db))[0].nome).toBe("Supino");
  await updateExercise(db, e.id, { nome: "Supino reto", grupo_muscular: "Peito" });
  expect((await listExercises(db))[0].nome).toBe("Supino reto");
});

it("deleta exercício sem uso; bloqueia se em uso", async () => {
  const e = await createExercise(db, { nome: "Agachamento", grupo_muscular: "Perna" });
  const r1 = await deleteExercise(db, e.id);
  expect(r1).toEqual({ ok: true });
  expect(await listExercises(db)).toHaveLength(0);

  const e2 = await createExercise(db, { nome: "Terra", grupo_muscular: "Costas" });
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (1, '2026-07-06', ?)",
    args: [now],
  });
  await db.execute({
    sql: `INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at)
          VALUES (1, 1, ?, 1, 5, 100, ?)`,
    args: [e2.id, now],
  });
  const r2 = await deleteExercise(db, e2.id);
  expect(r2).toEqual({ ok: false, reason: "em_uso" });
  expect(await listExercises(db)).toHaveLength(1);
});
