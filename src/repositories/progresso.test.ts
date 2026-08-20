import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { exerciciosComHistorico, seriesPorGrupo, sessoesComResumo } from "./progresso";
import { addSet, createSession } from "./workouts";
import { seedMuscleGroups } from "./muscle-groups";
import { e1RM } from "../domain/treino";

const USER = 1;
const OUTRO = 2;
let db: Client;

async function exercicio(nome: string, grupo?: string): Promise<number> {
  let grupoId: number | null = null;
  if (grupo) {
    const g = await db.execute({ sql: "SELECT id FROM muscle_groups WHERE nome=?", args: [grupo] });
    grupoId = g.rows.length ? (g.rows[0].id as number) : null;
  }
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, grupo_id, source, created_at) VALUES (?, ?, 'custom', ?)",
    args: [nome, grupoId, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

const serie = (over: Record<string, unknown> = {}) => ({
  session_id: 0, exercise_id: 0, ordem: 1, reps: 10, peso_kg: 40,
  tipo: "valida" as const, rir: null, nota: null, ...over,
});

beforeEach(async () => {
  db = await createTestDb();
  await seedMuscleGroups(db);
});

describe("sessoesComResumo", () => {
  it("resume séries efetivas e volume, da mais recente para a mais antiga", async () => {
    const supino = await exercicio("Supino");
    const s1 = await createSession(db, USER, { data: "2026-08-01", nome: "A" });
    await addSet(db, USER, serie({ session_id: s1.id, exercise_id: supino, reps: 10, peso_kg: 40 }));
    await addSet(db, USER, serie({ session_id: s1.id, exercise_id: supino, ordem: 2, reps: 8, peso_kg: 40 }));
    const s2 = await createSession(db, USER, { data: "2026-08-08", nome: "B" });
    await addSet(db, USER, serie({ session_id: s2.id, exercise_id: supino, reps: 5, peso_kg: 60 }));

    const r = await sessoesComResumo(db, USER);
    expect(r.map((x) => x.nome)).toEqual(["B", "A"]);
    expect(r[1].series).toBe(2);
    expect(r[1].volume_kg).toBe(10 * 40 + 8 * 40);
    expect(r[0].series).toBe(1);
    expect(r[0].volume_kg).toBe(300);
  });

  // O achado B3: uma sessão só com aquecimento aparecia como nome e data e mais
  // nada. A tela precisa do número para poder dizer "só aquecimento".
  it("distingue sessão só com aquecimento de sessão vazia", async () => {
    const supino = await exercicio("Supino");
    const so = await createSession(db, USER, { data: "2026-08-02", nome: "Só aquecimento" });
    await addSet(db, USER, serie({ session_id: so.id, exercise_id: supino, tipo: "aquecimento" }));
    await createSession(db, USER, { data: "2026-08-01", nome: "Vazia" });

    const r = await sessoesComResumo(db, USER);
    const soAquec = r.find((x) => x.nome === "Só aquecimento")!;
    const vazia = r.find((x) => x.nome === "Vazia")!;
    expect(soAquec.series).toBe(0);
    expect(soAquec.aquecimento).toBe(1);
    expect(vazia.series).toBe(0);
    expect(vazia.aquecimento).toBe(0);
  });

  it("marca a sessão encerrada", async () => {
    const s = await createSession(db, USER, { data: "2026-08-01", nome: "A" });
    expect((await sessoesComResumo(db, USER))[0].concluida).toBe(false);
    await db.execute({
      sql: "UPDATE workout_sessions SET concluida_em = ? WHERE id = ?",
      args: [new Date().toISOString(), s.id],
    });
    expect((await sessoesComResumo(db, USER))[0].concluida).toBe(true);
  });

  it("não enxerga sessão de outro usuário", async () => {
    await createSession(db, OUTRO, { data: "2026-08-01", nome: "Do outro" });
    expect(await sessoesComResumo(db, USER)).toEqual([]);
  });
});

describe("exerciciosComHistorico", () => {
  it("lista do mais recente para o mais antigo, com melhor carga e melhor 1RM", async () => {
    const supino = await exercicio("Supino", "Peito");
    const remada = await exercicio("Remada", "Costas");

    const s1 = await createSession(db, USER, { data: "2026-08-01", nome: null });
    await addSet(db, USER, serie({ session_id: s1.id, exercise_id: supino, reps: 10, peso_kg: 60 }));
    await addSet(db, USER, serie({ session_id: s1.id, exercise_id: remada, reps: 10, peso_kg: 50 }));
    const s2 = await createSession(db, USER, { data: "2026-08-08", nome: null });
    await addSet(db, USER, serie({ session_id: s2.id, exercise_id: supino, reps: 3, peso_kg: 80 }));

    const r = await exerciciosComHistorico(db, USER);
    expect(r.map((x) => x.nome)).toEqual(["Supino", "Remada"]);

    const sup = r[0];
    expect(sup.ultima).toBe("2026-08-08");
    expect(sup.sessoes).toBe(2);
    expect(sup.melhor_peso_kg).toBe(80);
    // 10×60 dá e1RM 80; 3×80 dá 88. O melhor é o segundo.
    expect(sup.melhor_e1rm).toBe(Math.round(e1RM(80, 3)));
    expect(r[1].grupo).toBe("Costas");
  });

  it("ignora aquecimento", async () => {
    const supino = await exercicio("Supino");
    const s = await createSession(db, USER, { data: "2026-08-01", nome: null });
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino, tipo: "aquecimento", peso_kg: 200 }));
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino, ordem: 2, peso_kg: 60 }));

    expect((await exerciciosComHistorico(db, USER))[0].melhor_peso_kg).toBe(60);
  });

  it("sem treino nenhum, a lista é vazia", async () => {
    expect(await exerciciosComHistorico(db, USER)).toEqual([]);
  });

  it("não mistura o histórico de outro usuário", async () => {
    const supino = await exercicio("Supino");
    const s = await createSession(db, OUTRO, { data: "2026-08-01", nome: null });
    await addSet(db, OUTRO, serie({ session_id: s.id, exercise_id: supino }));
    expect(await exerciciosComHistorico(db, USER)).toEqual([]);
  });
});

describe("seriesPorGrupo", () => {
  it("conta séries efetivas por grupo no período, da maior para a menor", async () => {
    const supino = await exercicio("Supino", "Peito");
    const remada = await exercicio("Remada", "Costas");
    const s = await createSession(db, USER, { data: "2026-08-05", nome: null });
    for (const ordem of [1, 2, 3]) {
      await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino, ordem }));
    }
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: remada, ordem: 4 }));

    expect(await seriesPorGrupo(db, USER, "2026-08-01", "2026-08-31")).toEqual([
      { grupo: "Peito", series: 3 },
      { grupo: "Costas", series: 1 },
    ]);
  });

  it("exercício sem grupo cai em 'Sem grupo'", async () => {
    const solto = await exercicio("Exercício solto");
    const s = await createSession(db, USER, { data: "2026-08-05", nome: null });
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: solto }));
    expect(await seriesPorGrupo(db, USER, "2026-08-01", "2026-08-31")).toEqual([
      { grupo: "Sem grupo", series: 1 },
    ]);
  });

  it("respeita o período", async () => {
    const supino = await exercicio("Supino", "Peito");
    const s = await createSession(db, USER, { data: "2026-07-01", nome: null });
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino }));
    expect(await seriesPorGrupo(db, USER, "2026-08-01", "2026-08-31")).toEqual([]);
  });
});
