import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  createSession, getSessionByDate, listSessions, deleteSession,
  addSet, listSetsBySession, deleteSet, setsForExercise,
  listSessionsByRange, setsForAnalise,
} from "./workouts";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute("INSERT INTO exercises (nome, grupo_muscular, created_at) VALUES ('Supino', 'peito', 't')");
});

const set = (over = {}) => ({ session_id: 0, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40, ...over });

describe("workouts repo", () => {
  it("isola sessões por usuário", async () => {
    await createSession(db, 1, { data: "2026-07-07", nome: "A" });
    await createSession(db, 2, { data: "2026-07-07", nome: "B" });
    expect(await listSessions(db, 1)).toHaveLength(1);
    expect((await getSessionByDate(db, 1, "2026-07-07"))?.nome).toBe("A");
    expect((await getSessionByDate(db, 2, "2026-07-07"))?.nome).toBe("B");
  });

  it("sets isolados; setsForExercise só vê os do usuário", async () => {
    const s1 = await createSession(db, 1, { data: "2026-07-07", nome: null });
    const s2 = await createSession(db, 2, { data: "2026-07-07", nome: null });
    await addSet(db, 1, set({ session_id: s1.id, peso_kg: 40 }));
    await addSet(db, 2, set({ session_id: s2.id, peso_kg: 90 }));
    expect(await listSetsBySession(db, 1, s1.id)).toHaveLength(1);
    const prog = await setsForExercise(db, 1, 1);
    expect(prog).toHaveLength(1);
    expect(prog[0].peso_kg).toBe(40);
  });

  it("deleteSession/deleteSet não afetam outro usuário", async () => {
    const s1 = await createSession(db, 1, { data: "2026-07-07", nome: null });
    const st = await addSet(db, 1, set({ session_id: s1.id }));
    await deleteSet(db, 2, st.id);
    expect(await listSetsBySession(db, 1, s1.id)).toHaveLength(1);
    await deleteSession(db, 2, s1.id);
    expect(await listSessions(db, 1)).toHaveLength(1);
    await deleteSession(db, 1, s1.id);
    expect(await listSessions(db, 1)).toHaveLength(0);
  });

  it("listSessionsByRange filtra por range e usuário", async () => {
    await createSession(db, 1, { data: "2026-07-05", nome: null });
    await createSession(db, 1, { data: "2026-07-06", nome: "A" });
    await createSession(db, 1, { data: "2026-07-12", nome: "B" });
    await createSession(db, 2, { data: "2026-07-07", nome: "X" });
    const r = await listSessionsByRange(db, 1, "2026-07-06", "2026-07-12");
    expect(r.map((x) => x.data)).toEqual(["2026-07-06", "2026-07-12"]);
  });

  it("setsForAnalise traz data da sessão + grupo do exercício, filtrado por range/usuário", async () => {
    const s1 = await createSession(db, 1, { data: "2026-07-06", nome: null });
    const sFora = await createSession(db, 1, { data: "2026-07-20", nome: null });
    await addSet(db, 1, { session_id: s1.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40 });
    await addSet(db, 1, { session_id: sFora.id, exercise_id: 1, ordem: 1, reps: 8, peso_kg: 50 });
    const r = await setsForAnalise(db, 1, "2026-07-06", "2026-07-12");
    expect(r).toEqual([{ data: "2026-07-06", reps: 10, peso_kg: 40, grupo: "peito" }]);
  });
});
