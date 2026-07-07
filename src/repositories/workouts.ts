import type { Client, Row } from "@libsql/client";
import type { WorkoutSession, WorkoutSet } from "../domain/types";

function mapSession(r: Row): WorkoutSession {
  return {
    id: r.id as number,
    data: r.data as string,
    nome: (r.nome as string | null) ?? null,
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
    created_at: r.created_at as string,
  };
}

export async function createSession(
  db: Client,
  s: { data: string; nome: string | null },
): Promise<WorkoutSession> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: "INSERT INTO workout_sessions (data, nome, created_at) VALUES (?, ?, ?)",
    args: [s.data, s.nome, created_at],
  });
  return { id: Number(rs.lastInsertRowid), data: s.data, nome: s.nome, created_at };
}

export async function getSessionByDate(db: Client, data: string): Promise<WorkoutSession | null> {
  const rs = await db.execute({
    sql: "SELECT * FROM workout_sessions WHERE data=? ORDER BY created_at LIMIT 1",
    args: [data],
  });
  return rs.rows.length ? mapSession(rs.rows[0]) : null;
}

export async function listSessions(db: Client, limite = 30): Promise<WorkoutSession[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM workout_sessions ORDER BY data DESC, created_at DESC LIMIT ?",
    args: [limite],
  });
  return rs.rows.map(mapSession);
}

export async function deleteSession(db: Client, id: number): Promise<void> {
  await db.batch(
    [
      { sql: "DELETE FROM workout_sets WHERE session_id = ?", args: [id] },
      { sql: "DELETE FROM workout_sessions WHERE id = ?", args: [id] },
    ],
    "write",
  );
}

export async function addSet(
  db: Client,
  s: { session_id: number; exercise_id: number; ordem: number; reps: number; peso_kg: number },
): Promise<WorkoutSet> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: `INSERT INTO workout_sets (session_id, exercise_id, ordem, reps, peso_kg, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [s.session_id, s.exercise_id, s.ordem, s.reps, s.peso_kg, created_at],
  });
  return { id: Number(rs.lastInsertRowid), created_at, ...s };
}

export async function listSetsBySession(db: Client, session_id: number): Promise<WorkoutSet[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM workout_sets WHERE session_id=? ORDER BY exercise_id, ordem",
    args: [session_id],
  });
  return rs.rows.map(mapSet);
}

export async function deleteSet(db: Client, id: number): Promise<void> {
  await db.execute({ sql: "DELETE FROM workout_sets WHERE id=?", args: [id] });
}

export async function setsForExercise(
  db: Client,
  exercise_id: number,
): Promise<{ data: string; peso_kg: number; reps: number }[]> {
  const rs = await db.execute({
    sql: `SELECT s.data AS data, ws.peso_kg AS peso_kg, ws.reps AS reps
          FROM workout_sets ws
          JOIN workout_sessions s ON s.id = ws.session_id
          WHERE ws.exercise_id = ?
          ORDER BY s.data`,
    args: [exercise_id],
  });
  return rs.rows.map((r) => ({
    data: r.data as string,
    peso_kg: r.peso_kg as number,
    reps: r.reps as number,
  }));
}
