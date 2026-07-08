import type { Client } from "@libsql/client";
import type { Pesagem } from "../domain/analise-peso";

export async function upsertWeighIn(
  db: Client,
  userId: number,
  data: string,
  peso_kg: number,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO weigh_ins (user_id, data, peso_kg, created_at) VALUES (?, ?, ?, ?)
          ON CONFLICT (user_id, data) DO UPDATE SET peso_kg=excluded.peso_kg, created_at=excluded.created_at`,
    args: [userId, data, peso_kg, new Date().toISOString()],
  });
}

export async function getWeighInsByRange(
  db: Client,
  userId: number,
  inicio: string,
  fim: string,
): Promise<Pesagem[]> {
  const rs = await db.execute({
    sql: "SELECT data, peso_kg FROM weigh_ins WHERE user_id=? AND data BETWEEN ? AND ? ORDER BY data",
    args: [userId, inicio, fim],
  });
  return rs.rows.map((r) => ({ data: r.data as string, peso_kg: r.peso_kg as number }));
}
