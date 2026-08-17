import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  adicionarExercicio,
  atualizarExercicio,
  criarRotina,
  getRotinaAtiva,
  listDias,
  listExercicios,
  listExerciciosDaRotina,
  removerDia,
  removerExercicio,
  reordenarExercicios,
  salvarDia,
  type ExercicioRotinaInput,
} from "./rotina";

const USER = 1;
const OUTRO = 2;
let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
    args: [nome, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

const DUPLA: ExercicioRotinaInput = {
  exercise_id: 0,
  prescricao: "dupla",
  series: 3,
  reps_min: 8,
  reps_max: 12,
  peso_kg: 40,
  incremento_kg: 2.5,
  tm_kg: null,
  parte: null,
  descanso_s: 90, duracao_min: null,
};

beforeEach(async () => {
  db = await createTestDb();
});

describe("rotina", () => {
  it("não há rotina ativa antes de criar uma", async () => {
    expect(await getRotinaAtiva(db, USER)).toBeNull();
  });

  it("cria e devolve a rotina ativa", async () => {
    const r = await criarRotina(db, USER, "Minha rotina");
    const ativa = await getRotinaAtiva(db, USER);
    expect(ativa?.id).toBe(r.id);
    expect(ativa?.nome).toBe("Minha rotina");
    expect(ativa?.ativa).toBe(true);
  });

  it("a rotina de um usuário não aparece para outro", async () => {
    await criarRotina(db, USER, "Minha rotina");
    expect(await getRotinaAtiva(db, OUTRO)).toBeNull();
  });

  it("salvarDia cria e depois renomeia o mesmo dia", async () => {
    const r = await criarRotina(db, USER, "R");
    const d1 = await salvarDia(db, USER, r.id, 1, "Peito");
    const d2 = await salvarDia(db, USER, r.id, 1, "Peito e tríceps");
    expect(d2.id).toBe(d1.id);
    const dias = await listDias(db, USER, r.id);
    expect(dias).toHaveLength(1);
    expect(dias[0].nome).toBe("Peito e tríceps");
  });

  it("lista os dias em ordem de dia da semana", async () => {
    const r = await criarRotina(db, USER, "R");
    await salvarDia(db, USER, r.id, 5, "Perna");
    await salvarDia(db, USER, r.id, 1, "Peito");
    await salvarDia(db, USER, r.id, 3, "Costas");
    expect((await listDias(db, USER, r.id)).map((d) => d.dia_semana)).toEqual([1, 3, 5]);
  });

  it("adiciona exercícios ao dia, numerando a ordem sozinho", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const supino = await exercicio("Supino reto");
    const crucifixo = await exercicio("Crucifixo");
    await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: supino });
    await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: crucifixo });

    const lista = await listExercicios(db, USER, d.id);
    expect(lista.map((e) => e.nome)).toEqual(["Supino reto", "Crucifixo"]);
    expect(lista.map((e) => e.ordem)).toEqual([1, 2]);
    expect(lista[0].series).toBe(3);
    expect(lista[0].reps_min).toBe(8);
    expect(lista[0].descanso_s).toBe(90);
  });

  it("atualiza a prescrição de um exercício", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Perna");
    const agacho = await exercicio("Agachamento");
    const id = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: agacho });

    await atualizarExercicio(db, USER, id, {
      exercise_id: agacho,
      prescricao: "531",
      series: 3,
      reps_min: null,
      reps_max: null,
      peso_kg: null,
      incremento_kg: 2.5,
      tm_kg: 120,
      parte: "inferior",
      descanso_s: 180, duracao_min: null,
    });

    const [e] = await listExercicios(db, USER, d.id);
    expect(e.prescricao).toBe("531");
    expect(e.tm_kg).toBe(120);
    expect(e.parte).toBe("inferior");
    expect(e.reps_min).toBeNull();
  });

  it("reordena os exercícios do dia", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const a = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("A") });
    const b = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("B") });
    const c = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("C") });

    await reordenarExercicios(db, USER, d.id, [c, a, b]);
    expect((await listExercicios(db, USER, d.id)).map((e) => e.nome)).toEqual(["C", "A", "B"]);
  });

  it("remover o dia leva os exercícios dele junto", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("Supino") });

    await removerDia(db, USER, d.id);
    expect(await listDias(db, USER, r.id)).toHaveLength(0);
    expect(await listExercicios(db, USER, d.id)).toHaveLength(0);
  });

  it("remove um exercício isolado", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const id = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("Supino") });
    await removerExercicio(db, USER, id);
    expect(await listExercicios(db, USER, d.id)).toHaveLength(0);
  });

  it("um usuário não apaga exercício da rotina do outro", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const id = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("Supino") });

    await removerExercicio(db, OUTRO, id);
    expect(await listExercicios(db, USER, d.id)).toHaveLength(1);
  });

  it("um usuário não adiciona exercício num dia que não é dele", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    await expect(
      adicionarExercicio(db, OUTRO, d.id, { ...DUPLA, exercise_id: await exercicio("Supino") }),
    ).rejects.toThrow();
  });

  it("lista a rotina inteira com o dia da semana de cada exercício", async () => {
    const r = await criarRotina(db, USER, "R");
    const seg = await salvarDia(db, USER, r.id, 1, "Peito");
    const qua = await salvarDia(db, USER, r.id, 3, "Costas");
    await adicionarExercicio(db, USER, seg.id, { ...DUPLA, exercise_id: await exercicio("Supino") });
    await adicionarExercicio(db, USER, qua.id, { ...DUPLA, exercise_id: await exercicio("Remada") });

    const todos = await listExerciciosDaRotina(db, USER, r.id);
    expect(todos.map((e) => [e.dia_semana, e.nome])).toEqual([
      [1, "Supino"],
      [3, "Remada"],
    ]);
  });
});
