import type { Client } from "@libsql/client";

export async function getWaterTotal(db: Client, data: string): Promise<number> {
  const rs = await db.execute({
    sql: "SELECT COALESCE(SUM(ml), 0) AS total FROM water_log WHERE data=?",
    args: [data],
  });
  return rs.rows[0].total as number;
}

export async function addWater(db: Client, data: string, ml: number): Promise<void> {
  await db.execute({
    sql: "INSERT INTO water_log (data, ml, created_at) VALUES (?, ?, ?)",
    args: [data, ml, new Date().toISOString()],
  });
}

export async function resetWater(db: Client, data: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM water_log WHERE data=?", args: [data] });
}
