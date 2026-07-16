import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  createSession, getSessionByDate, listSessions, deleteSession,
  addSet, listSetsBySession, deleteSet, setsForExercise, updateSet,
  listSessionsByRange, setsForAnalise, ultimaVezExercicio, updateSession,
} from "./workouts";
import { createExercise } from "./exercises";
import { seedMuscleGroups } from "./muscle-groups";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute("INSERT INTO exercises (nome, grupo_muscular, created_at) VALUES ('Supino', 'peito', 't')");
});

const set = (over = {}) => ({
  session_id: 0, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40,
  tipo: "valida" as const, rir: null, nota: null, ...over,
});

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
    await addSet(db, 1, { session_id: s1.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null });
    await addSet(db, 1, { session_id: sFora.id, exercise_id: 1, ordem: 1, reps: 8, peso_kg: 50, tipo: "valida", rir: null, nota: null });
    const r = await setsForAnalise(db, 1, "2026-07-06", "2026-07-12");
    // O exercício do beforeEach não tem grupo_id (só o legado grupo_muscular,
    // que setsForAnalise não lê mais) — por isso grupo vem null via LEFT JOIN.
    expect(r).toEqual([{ data: "2026-07-06", reps: 10, peso_kg: 40, grupo: null, tipo: "valida", rir: null }]);
  });

  it("updateSet altera reps/peso só da linha e filtra por usuário", async () => {
    const s1 = await createSession(db, 1, { data: "2026-07-07", nome: null });
    const st = await addSet(db, 1, set({ session_id: s1.id, reps: 10, peso_kg: 40 }));
    await updateSet(db, 1, st.id, { reps: 8, peso_kg: 50 });
    const depois = (await listSetsBySession(db, 1, s1.id))[0];
    expect(depois.reps).toBe(8);
    expect(depois.peso_kg).toBe(50);
    await updateSet(db, 2, st.id, { reps: 1, peso_kg: 1 }); // outro usuário não altera
    expect((await listSetsBySession(db, 1, s1.id))[0].reps).toBe(8);
  });

  it("addSet grava tipo, rir e nota; default é valida sem rir", async () => {
    const s = await createSession(db, 1, { data: "2026-07-16", nome: null });
    const a = await addSet(db, 1, {
      session_id: s.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40,
      tipo: "aquecimento", rir: null, nota: null,
    });
    expect(a.tipo).toBe("aquecimento");
    expect(a.rir).toBeNull();

    const b = await addSet(db, 1, {
      session_id: s.id, exercise_id: 1, ordem: 2, reps: 8, peso_kg: 60,
      tipo: "valida", rir: 2, nota: "pesado",
    });
    expect(b.tipo).toBe("valida");
    expect(b.rir).toBe(2);
    expect(b.nota).toBe("pesado");

    const lidos = await listSetsBySession(db, 1, s.id);
    expect(lidos.map((x) => x.tipo)).toEqual(["aquecimento", "valida"]);
    expect(lidos.map((x) => x.rir)).toEqual([null, 2]);
  });

  it("updateSet altera tipo e rir, e aceita limpar o rir", async () => {
    const s = await createSession(db, 1, { data: "2026-07-16", nome: null });
    const a = await addSet(db, 1, {
      session_id: s.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40,
      tipo: "valida", rir: 3, nota: null,
    });

    await updateSet(db, 1, a.id, { tipo: "drop", rir: 0 });
    let lido = (await listSetsBySession(db, 1, s.id))[0];
    expect(lido.tipo).toBe("drop");
    expect(lido.rir).toBe(0);

    await updateSet(db, 1, a.id, { rir: null });
    lido = (await listSetsBySession(db, 1, s.id))[0];
    expect(lido.rir).toBeNull();
    expect(lido.tipo).toBe("drop"); // não mexeu no que não foi passado
  });

  it("ultimaVezExercicio pega a sessão anterior mais recente, só séries válidas", async () => {
    const s1 = await createSession(db, 1, { data: "2026-07-10", nome: null });
    await addSet(db, 1, { session_id: s1.id, exercise_id: 1, ordem: 1, reps: 12, peso_kg: 30, tipo: "valida", rir: null, nota: null });

    const s2 = await createSession(db, 1, { data: "2026-07-12", nome: null });
    await addSet(db, 1, { session_id: s2.id, exercise_id: 1, ordem: 1, reps: 15, peso_kg: 20, tipo: "aquecimento", rir: null, nota: null });
    await addSet(db, 1, { session_id: s2.id, exercise_id: 1, ordem: 2, reps: 10, peso_kg: 40, tipo: "valida", rir: 2, nota: null });
    await addSet(db, 1, { session_id: s2.id, exercise_id: 1, ordem: 3, reps: 9, peso_kg: 40, tipo: "valida", rir: 1, nota: null });

    const r = await ultimaVezExercicio(db, 1, 1, "2026-07-16");
    expect(r?.data).toBe("2026-07-12");
    expect(r?.sets).toEqual([
      { reps: 10, peso_kg: 40, rir: 2 },
      { reps: 9, peso_kg: 40, rir: 1 },
    ]);
  });

  it("ultimaVezExercicio ignora sessão que só teve aquecimento", async () => {
    const s1 = await createSession(db, 1, { data: "2026-07-10", nome: null });
    await addSet(db, 1, { session_id: s1.id, exercise_id: 1, ordem: 1, reps: 12, peso_kg: 30, tipo: "valida", rir: null, nota: null });
    const s2 = await createSession(db, 1, { data: "2026-07-12", nome: null });
    await addSet(db, 1, { session_id: s2.id, exercise_id: 1, ordem: 1, reps: 15, peso_kg: 20, tipo: "aquecimento", rir: null, nota: null });

    const r = await ultimaVezExercicio(db, 1, 1, "2026-07-16");
    expect(r?.data).toBe("2026-07-10");
  });

  it("ultimaVezExercicio não funde séries de duas sessões na mesma data (chaveia por sessão, não por data)", async () => {
    // workout_sessions não tem UNIQUE (user_id, data) — duas sessões no mesmo
    // dia são possíveis. A 2ª query tem que travar na sessão que a 1ª achou,
    // não em "toda série desse exercício nessa data" (o que fundiria as duas).
    const sA = await createSession(db, 1, { data: "2026-07-12", nome: null });
    await addSet(db, 1, { session_id: sA.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null });
    await addSet(db, 1, { session_id: sA.id, exercise_id: 1, ordem: 2, reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null });

    const sB = await createSession(db, 1, { data: "2026-07-12", nome: null });
    await addSet(db, 1, { session_id: sB.id, exercise_id: 1, ordem: 1, reps: 5, peso_kg: 99, tipo: "valida", rir: null, nota: null });

    const r = await ultimaVezExercicio(db, 1, 1, "2026-07-16");
    expect(r?.data).toBe("2026-07-12");
    // 3 séries só é possível se as duas sessões foram fundidas.
    expect(r?.sets.length).not.toBe(3);
    // Pesos homogêneos: as séries vêm todas de UMA sessão (40kg×2, ou 99kg×1),
    // nunca uma mistura das duas.
    const pesos = new Set(r?.sets.map((s) => s.peso_kg));
    expect(pesos.size).toBe(1);
  });

  it("ultimaVezExercicio devolve null sem histórico e não olha o futuro nem o próprio dia", async () => {
    expect(await ultimaVezExercicio(db, 1, 1, "2026-07-16")).toBeNull();

    const hoje = await createSession(db, 1, { data: "2026-07-16", nome: null });
    await addSet(db, 1, { session_id: hoje.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 50, tipo: "valida", rir: null, nota: null });
    expect(await ultimaVezExercicio(db, 1, 1, "2026-07-16")).toBeNull();
  });

  it("ultimaVezExercicio não vaza sessão de outro usuário", async () => {
    const s = await createSession(db, 2, { data: "2026-07-10", nome: null });
    await addSet(db, 2, { session_id: s.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 99, tipo: "valida", rir: null, nota: null });
    expect(await ultimaVezExercicio(db, 1, 1, "2026-07-16")).toBeNull();
  });

  it("updateSession grava a nota da sessão e não mexe no nome", async () => {
    const s = await createSession(db, 1, { data: "2026-07-16", nome: "Treino A" });
    await updateSession(db, 1, s.id, { nota: "ombro incomodou" });

    const lida = await getSessionByDate(db, 1, "2026-07-16");
    expect(lida?.nota).toBe("ombro incomodou");
    expect(lida?.nome).toBe("Treino A");
  });

  it("updateSession não altera sessão de outro usuário", async () => {
    const s = await createSession(db, 2, { data: "2026-07-16", nome: null });
    await updateSession(db, 1, s.id, { nota: "invasão" });
    expect((await getSessionByDate(db, 2, "2026-07-16"))?.nota).toBeNull();
  });

  it("setsForAnalise devolve grupo pelo join, mais tipo e rir", async () => {
    await seedMuscleGroups(db);
    const gs = await db.execute("SELECT id FROM muscle_groups WHERE nome='Peito'");
    const ex = await createExercise(db, 1, { nome: "Supino", grupo_id: gs.rows[0].id as number });
    const semGrupo = await createExercise(db, 1, { nome: "Coisa", grupo_id: null });

    const s = await createSession(db, 1, { data: "2026-07-16", nome: null });
    await addSet(db, 1, { session_id: s.id, exercise_id: ex.id, ordem: 1, reps: 10, peso_kg: 40, tipo: "valida", rir: 2, nota: null });
    await addSet(db, 1, { session_id: s.id, exercise_id: semGrupo.id, ordem: 1, reps: 5, peso_kg: 10, tipo: "aquecimento", rir: null, nota: null });

    const sets = await setsForAnalise(db, 1, "2026-07-01", "2026-07-31");
    expect(sets).toEqual(
      expect.arrayContaining([
        { data: "2026-07-16", reps: 10, peso_kg: 40, grupo: "Peito", tipo: "valida", rir: 2 },
        { data: "2026-07-16", reps: 5, peso_kg: 10, grupo: null, tipo: "aquecimento", rir: null },
      ]),
    );
  });
});
