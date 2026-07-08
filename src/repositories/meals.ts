import type { Client, Row } from "@libsql/client";
import type { Meal } from "../domain/types";

const PADRAO: Omit<Meal, "id">[] = [
  { nome: "Café da manhã", horario: "07:00", ordem: 1 },
  { nome: "Almoço", horario: "12:00", ordem: 2 },
  { nome: "Café da tarde", horario: "16:00", ordem: 3 },
  { nome: "Jantar", horario: "20:00", ordem: 4 },
  { nome: "Ceia", horario: "22:00", ordem: 5 },
];

function mapRow(r: Row): Meal {
  return {
    id: r.id as number,
    nome: r.nome as string,
    horario: (r.horario as string | null) ?? null,
    ordem: r.ordem as number,
  };
}

export async function listMeals(db: Client, userId: number): Promise<Meal[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM meals WHERE user_id=? ORDER BY ordem",
    args: [userId],
  });
  return rs.rows.map(mapRow);
}

export async function createMeal(db: Client, userId: number, m: Omit<Meal, "id">): Promise<Meal> {
  const rs = await db.execute({
    sql: "INSERT INTO meals (user_id, nome, horario, ordem) VALUES (?, ?, ?, ?)",
    args: [userId, m.nome, m.horario, m.ordem],
  });
  return { id: Number(rs.lastInsertRowid), ...m };
}

export async function updateMeal(
  db: Client,
  userId: number,
  id: number,
  m: Omit<Meal, "id">,
): Promise<void> {
  await db.execute({
    sql: "UPDATE meals SET nome=?, horario=?, ordem=? WHERE id=? AND user_id=?",
    args: [m.nome, m.horario, m.ordem, id, userId],
  });
}

export async function deleteMeal(db: Client, userId: number, id: number): Promise<void> {
  await db.batch(
    [
      {
        sql: "UPDATE food_entries SET meal_id = NULL WHERE meal_id = ? AND user_id = ?",
        args: [id, userId],
      },
      { sql: "DELETE FROM meals WHERE id = ? AND user_id = ?", args: [id, userId] },
    ],
    "write",
  );
}

export async function seedDefaultMeals(db: Client, userId: number): Promise<void> {
  const rs = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM meals WHERE user_id=?",
    args: [userId],
  });
  if ((rs.rows[0].n as number) > 0) return;
  await db.batch(
    PADRAO.map((m) => ({
      sql: "INSERT INTO meals (user_id, nome, horario, ordem) VALUES (?, ?, ?, ?)",
      args: [userId, m.nome, m.horario, m.ordem],
    })),
    "write",
  );
}
