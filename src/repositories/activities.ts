import type { Client, Row } from "@libsql/client";
import type { ActivityType, ActivitySession } from "../domain/types";

const MET_PADRAO: { nome: string; met: number }[] = [
  { nome: "Caminhada", met: 3.5 },
  { nome: "Corrida", met: 9.8 },
  { nome: "Bicicleta", met: 7.5 },
  { nome: "Natação", met: 8.0 },
  { nome: "Muay Thai", met: 10.0 },
  { nome: "Boxe", met: 9.0 },
  { nome: "Jiu-Jitsu", met: 10.0 },
  { nome: "Musculação", met: 5.0 },
  { nome: "HIIT", met: 8.0 },
  { nome: "Pular corda", met: 11.0 },
  { nome: "Funcional", met: 6.0 },
  { nome: "Elíptico", met: 5.0 },
];

function mapType(r: Row): ActivityType {
  return { id: r.id as number, nome: r.nome as string, met: r.met as number };
}

function mapSession(r: Row): ActivitySession {
  return {
    id: r.id as number,
    data: r.data as string,
    tipo: r.tipo as string,
    duracao_min: r.duracao_min as number,
    kcal: r.kcal as number,
    created_at: r.created_at as string,
  };
}

export async function listActivityTypes(db: Client): Promise<ActivityType[]> {
  const rs = await db.execute("SELECT * FROM activity_types ORDER BY nome");
  return rs.rows.map(mapType);
}

export async function seedActivityTypes(db: Client): Promise<void> {
  const rs = await db.execute("SELECT COUNT(*) AS n FROM activity_types");
  if ((rs.rows[0].n as number) > 0) return;
  await db.batch(
    MET_PADRAO.map((t) => ({
      sql: "INSERT INTO activity_types (nome, met) VALUES (?, ?)",
      args: [t.nome, t.met],
    })),
    "write",
  );
}

export async function createActivitySession(
  db: Client,
  userId: number,
  a: { data: string; tipo: string; duracao_min: number; kcal: number },
): Promise<ActivitySession> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: `INSERT INTO activity_sessions (user_id, data, tipo, duracao_min, kcal, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId, a.data, a.tipo, a.duracao_min, a.kcal, created_at],
  });
  return { id: Number(rs.lastInsertRowid), created_at, ...a };
}

export async function listActivitySessions(
  db: Client,
  userId: number,
  limite = 30,
): Promise<ActivitySession[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM activity_sessions WHERE user_id=? ORDER BY data DESC, created_at DESC LIMIT ?",
    args: [userId, limite],
  });
  return rs.rows.map(mapSession);
}

export async function deleteActivitySession(db: Client, userId: number, id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM activity_sessions WHERE id=? AND user_id=?",
    args: [id, userId],
  });
}
