import type { Client } from "@libsql/client";

export async function getWaterTotal(db: Client, userId: number, data: string): Promise<number> {
  const rs = await db.execute({
    sql: "SELECT COALESCE(SUM(ml), 0) AS total FROM water_log WHERE user_id=? AND data=?",
    args: [userId, data],
  });
  return rs.rows[0].total as number;
}

export async function addWater(db: Client, userId: number, data: string, ml: number): Promise<void> {
  await db.execute({
    sql: "INSERT INTO water_log (user_id, data, ml, created_at) VALUES (?, ?, ?, ?)",
    args: [userId, data, ml, new Date().toISOString()],
  });
}

export async function resetWater(db: Client, userId: number, data: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM water_log WHERE user_id=? AND data=?",
    args: [userId, data],
  });
}
