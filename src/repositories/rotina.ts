import type { Client, Row } from "@libsql/client";
import type { Parte } from "../domain/531";
import type { TipoPrescricao } from "../domain/prescricao";

export interface Rotina {
  id: number;
  nome: string;
  ativa: boolean;
  created_at: string;
}

export interface DiaRotina {
  id: number;
  routine_id: number;
  dia_semana: number;
  nome: string;
}

export interface ExercicioRotina {
  id: number;
  day_id: number;
  exercise_id: number;
  /** Vem de `exercises.nome` — a tela nunca precisa de um segundo join. */
  nome: string;
  ordem: number;
  prescricao: TipoPrescricao;
  series: number;
  reps_min: number | null;
  reps_max: number | null;
  peso_kg: number | null;
  incremento_kg: number;
  tm_kg: number | null;
  parte: Parte | null;
  descanso_s: number | null;
}

export type ExercicioRotinaInput = Omit<ExercicioRotina, "id" | "day_id" | "nome" | "ordem">;

/**
 * Os dias que pertencem ao usuário, para o WHERE das escritas.
 *
 * `routine_days` e `routine_exercises` não guardam `user_id`: a posse sobe por
 * `routines`. Denormalizar o dono em três tabelas criaria três lugares para
 * ele divergir.
 */
const DIAS_DO_USUARIO = `
  SELECT d.id FROM routine_days d
  JOIN routines r ON r.id = d.routine_id
  WHERE r.user_id = ?`;

function mapRotina(r: Row): Rotina {
  return {
    id: r.id as number,
    nome: r.nome as string,
    ativa: Number(r.ativa) === 1,
    created_at: r.created_at as string,
  };
}

function mapDia(r: Row): DiaRotina {
  return {
    id: r.id as number,
    routine_id: r.routine_id as number,
    dia_semana: r.dia_semana as number,
    nome: r.nome as string,
  };
}

function mapExercicio(r: Row): ExercicioRotina {
  return {
    id: r.id as number,
    day_id: r.day_id as number,
    exercise_id: r.exercise_id as number,
    nome: (r.exercicio_nome as string | null) ?? "?",
    ordem: r.ordem as number,
    prescricao: r.prescricao as TipoPrescricao,
    series: r.series as number,
    reps_min: (r.reps_min as number | null) ?? null,
    reps_max: (r.reps_max as number | null) ?? null,
    peso_kg: (r.peso_kg as number | null) ?? null,
    incremento_kg: r.incremento_kg as number,
    tm_kg: (r.tm_kg as number | null) ?? null,
    parte: (r.parte as Parte | null) ?? null,
    descanso_s: (r.descanso_s as number | null) ?? null,
  };
}

export async function getRotinaAtiva(db: Client, userId: number): Promise<Rotina | null> {
  const rs = await db.execute({
    sql: "SELECT * FROM routines WHERE user_id=? AND ativa=1 ORDER BY id DESC LIMIT 1",
    args: [userId],
  });
  return rs.rows.length ? mapRotina(rs.rows[0]) : null;
}

export async function criarRotina(db: Client, userId: number, nome: string): Promise<Rotina> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: "INSERT INTO routines (user_id, nome, ativa, created_at) VALUES (?, ?, 1, ?)",
    args: [userId, nome, created_at],
  });
  return { id: Number(rs.lastInsertRowid), nome, ativa: true, created_at };
}

export async function listDias(
  db: Client,
  userId: number,
  routineId: number,
): Promise<DiaRotina[]> {
  const rs = await db.execute({
    sql: `SELECT d.* FROM routine_days d
          JOIN routines r ON r.id = d.routine_id
          WHERE r.user_id = ? AND d.routine_id = ?
          ORDER BY d.dia_semana`,
    args: [userId, routineId],
  });
  return rs.rows.map(mapDia);
}

/** Cria o dia ou renomeia o que já existe naquele dia da semana. */
export async function salvarDia(
  db: Client,
  userId: number,
  routineId: number,
  dia_semana: number,
  nome: string,
): Promise<DiaRotina> {
  const dono = await db.execute({
    sql: "SELECT id FROM routines WHERE id=? AND user_id=?",
    args: [routineId, userId],
  });
  if (!dono.rows.length) throw new Error("rotina não encontrada");

  await db.execute({
    sql: `INSERT INTO routine_days (routine_id, dia_semana, nome) VALUES (?, ?, ?)
          ON CONFLICT (routine_id, dia_semana) DO UPDATE SET nome = excluded.nome`,
    args: [routineId, dia_semana, nome],
  });

  const rs = await db.execute({
    sql: "SELECT * FROM routine_days WHERE routine_id=? AND dia_semana=?",
    args: [routineId, dia_semana],
  });
  return mapDia(rs.rows[0]);
}

export async function removerDia(db: Client, userId: number, dayId: number): Promise<void> {
  // Apaga o filho antes do pai em vez de contar com ON DELETE CASCADE: a
  // pragma de chave estrangeira não é garantida ligada, e `deleteSession` já
  // resolve assim neste repositório.
  await db.batch(
    [
      {
        sql: `DELETE FROM routine_exercises WHERE day_id = ? AND day_id IN (${DIAS_DO_USUARIO})`,
        args: [dayId, userId],
      },
      {
        sql: `DELETE FROM routine_days WHERE id = ? AND id IN (${DIAS_DO_USUARIO})`,
        args: [dayId, userId],
      },
    ],
    "write",
  );
}

const SELECT_EXERCICIOS = `
  SELECT re.*, e.nome AS exercicio_nome, d.dia_semana AS dia_semana
  FROM routine_exercises re
  JOIN routine_days d ON d.id = re.day_id
  JOIN routines r     ON r.id = d.routine_id
  LEFT JOIN exercises e ON e.id = re.exercise_id
  WHERE r.user_id = ?`;

export async function listExercicios(
  db: Client,
  userId: number,
  dayId: number,
): Promise<ExercicioRotina[]> {
  const rs = await db.execute({
    sql: `${SELECT_EXERCICIOS} AND re.day_id = ? ORDER BY re.ordem`,
    args: [userId, dayId],
  });
  return rs.rows.map(mapExercicio);
}

export async function listExerciciosDaRotina(
  db: Client,
  userId: number,
  routineId: number,
): Promise<(ExercicioRotina & { dia_semana: number })[]> {
  const rs = await db.execute({
    sql: `${SELECT_EXERCICIOS} AND d.routine_id = ? ORDER BY d.dia_semana, re.ordem`,
    args: [userId, routineId],
  });
  return rs.rows.map((r) => ({ ...mapExercicio(r), dia_semana: r.dia_semana as number }));
}

/** O dia é do usuário? Portão das escritas que inserem — um `WHERE` não
 *  protege um `INSERT`, então a checagem é explícita. */
async function ehDono(db: Client, userId: number, dayId: number): Promise<boolean> {
  const rs = await db.execute({
    sql: `SELECT 1 AS ok FROM routine_days d
          JOIN routines r ON r.id = d.routine_id
          WHERE d.id = ? AND r.user_id = ?`,
    args: [dayId, userId],
  });
  return rs.rows.length > 0;
}

export async function adicionarExercicio(
  db: Client,
  userId: number,
  dayId: number,
  e: ExercicioRotinaInput,
): Promise<number> {
  if (!(await ehDono(db, userId, dayId))) throw new Error("dia não encontrado");

  // MAX(ordem)+1, não COUNT+1: apagar um exercício do meio deixa buraco na
  // sequência, e COUNT+1 repetiria uma ordem já usada.
  const rs0 = await db.execute({
    sql: "SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima FROM routine_exercises WHERE day_id = ?",
    args: [dayId],
  });

  const rs = await db.execute({
    sql: `INSERT INTO routine_exercises
            (day_id, exercise_id, ordem, prescricao, series, reps_min, reps_max,
             peso_kg, incremento_kg, tm_kg, parte, descanso_s)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      dayId, e.exercise_id, rs0.rows[0].proxima as number, e.prescricao, e.series,
      e.reps_min, e.reps_max, e.peso_kg, e.incremento_kg, e.tm_kg, e.parte, e.descanso_s,
    ],
  });
  return Number(rs.lastInsertRowid);
}

export async function atualizarExercicio(
  db: Client,
  userId: number,
  id: number,
  e: ExercicioRotinaInput,
): Promise<void> {
  await db.execute({
    sql: `UPDATE routine_exercises
          SET exercise_id=?, prescricao=?, series=?, reps_min=?, reps_max=?,
              peso_kg=?, incremento_kg=?, tm_kg=?, parte=?, descanso_s=?
          WHERE id = ? AND day_id IN (${DIAS_DO_USUARIO})`,
    args: [
      e.exercise_id, e.prescricao, e.series, e.reps_min, e.reps_max,
      e.peso_kg, e.incremento_kg, e.tm_kg, e.parte, e.descanso_s,
      id, userId,
    ],
  });
}

export async function removerExercicio(db: Client, userId: number, id: number): Promise<void> {
  await db.execute({
    sql: `DELETE FROM routine_exercises WHERE id = ? AND day_id IN (${DIAS_DO_USUARIO})`,
    args: [id, userId],
  });
}

/** Grava a ordem dos exercícios do dia como a sequência de ids recebida. */
export async function reordenarExercicios(
  db: Client,
  userId: number,
  dayId: number,
  ids: number[],
): Promise<void> {
  if (ids.length === 0) return;
  await db.batch(
    ids.map((id, i) => ({
      sql: `UPDATE routine_exercises SET ordem = ?
            WHERE id = ? AND day_id = ? AND day_id IN (${DIAS_DO_USUARIO})`,
      args: [i + 1, id, dayId, userId],
    })),
    "write",
  );
}
