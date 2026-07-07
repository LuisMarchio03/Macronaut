import type { Client, Row } from "@libsql/client";
import type { Exercise } from "../domain/types";

function mapRow(r: Row): Exercise {
  return {
    id: r.id as number,
    nome: r.nome as string,
    grupo_muscular: (r.grupo_muscular as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

export async function listExercises(db: Client): Promise<Exercise[]> {
  const rs = await db.execute("SELECT * FROM exercises ORDER BY nome");
  return rs.rows.map(mapRow);
}

export async function createExercise(
  db: Client,
  e: { nome: string; grupo_muscular: string | null },
): Promise<Exercise> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, grupo_muscular, created_at) VALUES (?, ?, ?)",
    args: [e.nome, e.grupo_muscular, created_at],
  });
  return { id: Number(rs.lastInsertRowid), nome: e.nome, grupo_muscular: e.grupo_muscular, created_at };
}

export async function updateExercise(
  db: Client,
  id: number,
  e: { nome: string; grupo_muscular: string | null },
): Promise<void> {
  await db.execute({
    sql: "UPDATE exercises SET nome=?, grupo_muscular=? WHERE id=?",
    args: [e.nome, e.grupo_muscular, id],
  });
}

export async function deleteExercise(
  db: Client,
  id: number,
): Promise<{ ok: true } | { ok: false; reason: "em_uso" }> {
  const usado = await db.execute({
    sql: "SELECT 1 FROM workout_sets WHERE exercise_id=? LIMIT 1",
    args: [id],
  });
  if (usado.rows.length) return { ok: false, reason: "em_uso" };
  await db.execute({ sql: "DELETE FROM exercises WHERE id=?", args: [id] });
  return { ok: true };
}
