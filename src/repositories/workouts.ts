import type { Client, Row } from "@libsql/client";
import type { TipoSerie, WorkoutSession, WorkoutSet } from "../domain/types";
import type { SetAnalise } from "../domain/analise-treino";

function mapSession(r: Row): WorkoutSession {
  return {
    id: r.id as number,
    data: r.data as string,
    nome: (r.nome as string | null) ?? null,
    nota: (r.nota as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

function mapSet(r: Row): WorkoutSet {
  return {
    id: r.id as number,
    session_id: r.session_id as number,
    exercise_id: r.exercise_id as number,
    ordem: r.ordem as number,
    reps: r.reps as number,
    peso_kg: r.peso_kg as number,
    tipo: r.tipo as TipoSerie,
    rir: (r.rir as number | null) ?? null,
    nota: (r.nota as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

export async function createSession(
  db: Client,
  userId: number,
  s: { data: string; nome: string | null },
): Promise<WorkoutSession> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: "INSERT INTO workout_sessions (user_id, data, nome, created_at) VALUES (?, ?, ?, ?)",
    args: [userId, s.data, s.nome, created_at],
  });
  return { id: Number(rs.lastInsertRowid), data: s.data, nome: s.nome, nota: null, created_at };
}

export async function getSessionByDate(
  db: Client,
  userId: number,
  data: string,
): Promise<WorkoutSession | null> {
  const rs = await db.execute({
    sql: "SELECT * FROM workout_sessions WHERE user_id=? AND data=? ORDER BY created_at LIMIT 1",
    args: [userId, data],
  });
  return rs.rows.length ? mapSession(rs.rows[0]) : null;
}

export async function listSessions(
  db: Client,
  userId: number,
  limite = 30,
): Promise<WorkoutSession[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM workout_sessions WHERE user_id=? ORDER BY data DESC, created_at DESC LIMIT ?",
    args: [userId, limite],
  });
  return rs.rows.map(mapSession);
}

export async function deleteSession(db: Client, userId: number, id: number): Promise<void> {
  await db.batch(
    [
      { sql: "DELETE FROM workout_sets WHERE session_id = ? AND user_id = ?", args: [id, userId] },
      { sql: "DELETE FROM workout_sessions WHERE id = ? AND user_id = ?", args: [id, userId] },
    ],
    "write",
  );
}

export type SetInput = {
  session_id: number;
  exercise_id: number;
  ordem: number;
  reps: number;
  peso_kg: number;
  tipo: TipoSerie;
  rir: number | null;
  nota: string | null;
};

export async function addSet(db: Client, userId: number, s: SetInput): Promise<WorkoutSet> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: `INSERT INTO workout_sets
            (user_id, session_id, exercise_id, ordem, reps, peso_kg, tipo, rir, nota, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, s.session_id, s.exercise_id, s.ordem, s.reps, s.peso_kg, s.tipo, s.rir, s.nota, created_at],
  });
  return { id: Number(rs.lastInsertRowid), created_at, ...s };
}

export async function listSetsBySession(
  db: Client,
  userId: number,
  session_id: number,
): Promise<WorkoutSet[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM workout_sets WHERE user_id=? AND session_id=? ORDER BY exercise_id, ordem",
    args: [userId, session_id],
  });
  return rs.rows.map(mapSet);
}

export async function deleteSet(db: Client, userId: number, id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM workout_sets WHERE id=? AND user_id=?",
    args: [id, userId],
  });
}

export async function setsForExercise(
  db: Client,
  userId: number,
  exercise_id: number,
): Promise<{ data: string; peso_kg: number; reps: number }[]> {
  const rs = await db.execute({
    sql: `SELECT s.data AS data, ws.peso_kg AS peso_kg, ws.reps AS reps
          FROM workout_sets ws
          JOIN workout_sessions s ON s.id = ws.session_id
          WHERE ws.user_id = ? AND ws.exercise_id = ?
          ORDER BY s.data`,
    args: [userId, exercise_id],
  });
  return rs.rows.map((r) => ({
    data: r.data as string,
    peso_kg: r.peso_kg as number,
    reps: r.reps as number,
  }));
}

export async function listSessionsByRange(
  db: Client,
  userId: number,
  inicio: string,
  fim: string,
): Promise<WorkoutSession[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM workout_sessions WHERE user_id=? AND data BETWEEN ? AND ? ORDER BY data, created_at",
    args: [userId, inicio, fim],
  });
  return rs.rows.map(mapSession);
}

export async function setsForAnalise(
  db: Client,
  userId: number,
  inicio: string,
  fim: string,
): Promise<SetAnalise[]> {
  const rs = await db.execute({
    sql: `SELECT s.data AS data, ws.reps AS reps, ws.peso_kg AS peso_kg,
                 ws.tipo AS tipo, ws.rir AS rir, mg.nome AS grupo
          FROM workout_sets ws
          JOIN workout_sessions s ON s.id = ws.session_id
          JOIN exercises e ON e.id = ws.exercise_id
          LEFT JOIN muscle_groups mg ON mg.id = e.grupo_id
          WHERE ws.user_id = ? AND s.data BETWEEN ? AND ?
          ORDER BY s.data`,
    args: [userId, inicio, fim],
  });
  return rs.rows.map((r) => ({
    data: r.data as string,
    reps: r.reps as number,
    peso_kg: r.peso_kg as number,
    tipo: r.tipo as TipoSerie,
    rir: (r.rir as number | null) ?? null,
    grupo: (r.grupo as string | null) ?? null,
  }));
}

export async function updateSet(
  db: Client,
  userId: number,
  id: number,
  campos: { reps?: number; peso_kg?: number; tipo?: TipoSerie; rir?: number | null; nota?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const args: (number | string | null)[] = [];
  if (campos.reps !== undefined) { sets.push("reps=?"); args.push(campos.reps); }
  if (campos.peso_kg !== undefined) { sets.push("peso_kg=?"); args.push(campos.peso_kg); }
  if (campos.tipo !== undefined) { sets.push("tipo=?"); args.push(campos.tipo); }
  if (campos.rir !== undefined) { sets.push("rir=?"); args.push(campos.rir); }
  if (campos.nota !== undefined) { sets.push("nota=?"); args.push(campos.nota); }
  if (sets.length === 0) return;
  args.push(id, userId);
  await db.execute({
    sql: `UPDATE workout_sets SET ${sets.join(", ")} WHERE id=? AND user_id=?`,
    args,
  });
}

export async function updateSession(
  db: Client,
  userId: number,
  id: number,
  campos: { nome?: string | null; nota?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (campos.nome !== undefined) { sets.push("nome=?"); args.push(campos.nome); }
  if (campos.nota !== undefined) { sets.push("nota=?"); args.push(campos.nota); }
  if (sets.length === 0) return;
  args.push(id, userId);
  await db.execute({
    sql: `UPDATE workout_sessions SET ${sets.join(", ")} WHERE id=? AND user_id=?`,
    args,
  });
}

export type UltimaVez = {
  data: string;
  sets: { reps: number; peso_kg: number; rir: number | null }[];
};

/**
 * As séries efetivas do exercício na sessão mais recente **anterior** a `antesDe`.
 * Sessão que só teve aquecimento é ignorada (o filtro de tipo está nas duas
 * queries, de propósito). Devolve null se não há histórico.
 */
export async function ultimaVezExercicio(
  db: Client,
  userId: number,
  exercise_id: number,
  antesDe: string,
): Promise<UltimaVez | null> {
  const rs = await db.execute({
    sql: `SELECT s.id AS session_id, s.data AS data
          FROM workout_sets ws
          JOIN workout_sessions s ON s.id = ws.session_id
          WHERE ws.user_id = ? AND ws.exercise_id = ? AND s.data < ? AND ws.tipo <> 'aquecimento'
          ORDER BY s.data DESC LIMIT 1`,
    args: [userId, exercise_id, antesDe],
  });
  if (!rs.rows.length) return null;
  const data = rs.rows[0].data as string;
  const sessionId = rs.rows[0].session_id as number;

  // Chaveado por session_id (não por data): `workout_sessions` não tem UNIQUE
  // (user_id, data), então duas sessões no mesmo dia são possíveis (dado
  // legado). Chavear por data fundiria as séries das duas.
  const rs2 = await db.execute({
    sql: `SELECT ws.reps AS reps, ws.peso_kg AS peso_kg, ws.rir AS rir
          FROM workout_sets ws
          WHERE ws.user_id = ? AND ws.exercise_id = ? AND ws.session_id = ? AND ws.tipo <> 'aquecimento'
          ORDER BY ws.ordem`,
    args: [userId, exercise_id, sessionId],
  });
  return {
    data,
    sets: rs2.rows.map((r) => ({
      reps: r.reps as number,
      peso_kg: r.peso_kg as number,
      rir: (r.rir as number | null) ?? null,
    })),
  };
}
