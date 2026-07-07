import type { Client, Row } from "@libsql/client";
import type { Food } from "../domain/types";

function mapRow(r: Row): Food {
  return {
    id: r.id as number,
    nome: r.nome as string,
    source: r.source as Food["source"],
    marca: (r.marca as string | null) ?? null,
    base_qty_g: r.base_qty_g as number,
    kcal: r.kcal as number,
    prot_g: r.prot_g as number,
    carb_g: r.carb_g as number,
    gord_g: r.gord_g as number,
    created_at: r.created_at as string,
  };
}

export async function searchFoods(db: Client, termo: string, limite = 30): Promise<Food[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM foods WHERE nome LIKE ? COLLATE NOCASE ORDER BY nome LIMIT ?",
    args: [`%${termo}%`, limite],
  });
  return rs.rows.map(mapRow);
}

export async function getFoodsByIds(db: Client, ids: number[]): Promise<Map<number, Food>> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rs = await db.execute({
    sql: `SELECT * FROM foods WHERE id IN (${placeholders})`,
    args: ids,
  });
  return new Map(rs.rows.map((r) => { const f = mapRow(r); return [f.id, f]; }));
}

export async function createFood(
  db: Client,
  f: Omit<Food, "id" | "source" | "created_at">,
): Promise<Food> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: `INSERT INTO foods (nome, source, marca, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES (?, 'custom', ?, ?, ?, ?, ?, ?, ?)`,
    args: [f.nome, f.marca, f.base_qty_g, f.kcal, f.prot_g, f.carb_g, f.gord_g, created_at],
  });
  return { id: Number(rs.lastInsertRowid), source: "custom", created_at, ...f };
}

export async function updateFood(
  db: Client,
  id: number,
  f: Omit<Food, "id" | "source" | "created_at">,
): Promise<void> {
  await db.execute({
    sql: `UPDATE foods SET nome=?, marca=?, base_qty_g=?, kcal=?, prot_g=?, carb_g=?, gord_g=?
          WHERE id=? AND source='custom'`,
    args: [f.nome, f.marca, f.base_qty_g, f.kcal, f.prot_g, f.carb_g, f.gord_g, id],
  });
}

export async function deleteFood(db: Client, id: number): Promise<void> {
  await db.execute({ sql: "DELETE FROM foods WHERE id=? AND source='custom'", args: [id] });
}

export async function listCustomFoods(db: Client): Promise<Food[]> {
  const rs = await db.execute("SELECT * FROM foods WHERE source='custom' ORDER BY nome");
  return rs.rows.map(mapRow);
}
