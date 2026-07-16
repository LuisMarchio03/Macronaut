import type { Client, Row } from "@libsql/client";
import type { FoodEntry } from "../domain/types";

function mapRow(r: Row): FoodEntry {
  return {
    id: r.id as number,
    data: r.data as string,
    meal_id: (r.meal_id as number | null) ?? null,
    food_id: r.food_id as number,
    qty_g: r.qty_g as number,
    measure_id: (r.measure_id as number | null) ?? null,
    measure_count: (r.measure_count as number | null) ?? null,
    label: (r.label as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

export async function listEntriesByDate(
  db: Client,
  userId: number,
  data: string,
): Promise<FoodEntry[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM food_entries WHERE user_id=? AND data=? ORDER BY created_at",
    args: [userId, data],
  });
  return rs.rows.map(mapRow);
}

export async function listEntriesByRange(
  db: Client,
  userId: number,
  inicio: string,
  fim: string,
): Promise<FoodEntry[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM food_entries WHERE user_id=? AND data BETWEEN ? AND ? ORDER BY data, created_at",
    args: [userId, inicio, fim],
  });
  return rs.rows.map(mapRow);
}

export async function createEntry(
  db: Client,
  userId: number,
  e: Omit<FoodEntry, "id" | "created_at">,
): Promise<FoodEntry> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: `INSERT INTO food_entries (user_id, data, meal_id, food_id, qty_g, label, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, e.data, e.meal_id, e.food_id, e.qty_g, e.label, created_at],
  });
  return { id: Number(rs.lastInsertRowid), created_at, ...e };
}

export async function deleteEntry(db: Client, userId: number, id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM food_entries WHERE id=? AND user_id=?",
    args: [id, userId],
  });
}

export async function updateEntry(
  db: Client,
  userId: number,
  id: number,
  campos: { qty_g?: number; meal_id?: number | null },
): Promise<void> {
  const sets: string[] = [];
  const args: (number | null)[] = [];
  if (campos.qty_g !== undefined) { sets.push("qty_g=?"); args.push(campos.qty_g); }
  if (campos.meal_id !== undefined) { sets.push("meal_id=?"); args.push(campos.meal_id); }
  if (sets.length === 0) return;
  args.push(id, userId);
  await db.execute({
    sql: `UPDATE food_entries SET ${sets.join(", ")} WHERE id=? AND user_id=?`,
    args,
  });
}
