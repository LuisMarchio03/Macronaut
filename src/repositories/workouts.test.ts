import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  createSession, getSessionByDate, listSessions, deleteSession,
  addSet, listSetsBySession, deleteSet, setsForExercise,
} from "./workouts";

let db: Client;
let exId: number;
beforeEach(async () => {
  db = await createTestDb();
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, created_at) VALUES ('Supino', ?)",
    args: [new Date().toISOString()],
  });
  exId = Number(rs.lastInsertRowid);
});

it("cria sessão e busca por data", async () => {
  const s = await createSession(db, { data: "2026-07-06", nome: "Treino A" });
  expect(s.id).toBeGreaterThan(0);
  expect((await getSessionByDate(db, "2026-07-06"))?.nome).toBe("Treino A");
  expect(await getSessionByDate(db, "2026-07-05")).toBeNull();
});

it("adiciona séries e lista por sessão", async () => {
  const s = await createSession(db, { data: "2026-07-06", nome: null });
  await addSet(db, { session_id: s.id, exercise_id: exId, ordem: 1, reps: 10, peso_kg: 80 });
  await addSet(db, { session_id: s.id, exercise_id: exId, ordem: 2, reps: 8, peso_kg: 82.5 });
  const sets = await listSetsBySession(db, s.id);
  expect(sets).toHaveLength(2);
  expect(sets[0].peso_kg).toBe(80);
});

it("deleteSession apaga as séries junto (batch)", async () => {
  const s = await createSession(db, { data: "2026-07-06", nome: null });
  await addSet(db, { session_id: s.id, exercise_id: exId, ordem: 1, reps: 5, peso_kg: 100 });
  await deleteSession(db, s.id);
  expect(await listSessions(db)).toHaveLength(0);
  expect(await listSetsBySession(db, s.id)).toHaveLength(0);
});

it("setsForExercise devolve pontos com a data da sessão", async () => {
  const s1 = await createSession(db, { data: "2026-06-30", nome: null });
  const s2 = await createSession(db, { data: "2026-07-06", nome: null });
  await addSet(db, { session_id: s1.id, exercise_id: exId, ordem: 1, reps: 10, peso_kg: 75 });
  await addSet(db, { session_id: s2.id, exercise_id: exId, ordem: 1, reps: 10, peso_kg: 80 });
  const pts = await setsForExercise(db, exId);
  expect(pts).toHaveLength(2);
  expect(pts.every((p) => typeof p.data === "string" && p.peso_kg > 0)).toBe(true);
});

it("deleteSet remove uma série", async () => {
  const s = await createSession(db, { data: "2026-07-06", nome: null });
  const set = await addSet(db, { session_id: s.id, exercise_id: exId, ordem: 1, reps: 5, peso_kg: 60 });
  await deleteSet(db, set.id);
  expect(await listSetsBySession(db, s.id)).toHaveLength(0);
});
