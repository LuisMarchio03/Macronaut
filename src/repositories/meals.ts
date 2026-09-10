import type { Client, Row } from "@libsql/client";
import type { Meal } from "../domain/types.js";

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

/**
 * Põe as refeições na ordem pedida, numerando de 1 em diante.
 *
 * Refeição que não veio na lista vai para o fim em vez de sumir: a tela manda
 * a ordem que conhece, e uma lista incompleta não pode apagar refeição nem
 * empilhar duas na mesma posição.
 */
export async function reordenarMeals(
  db: Client,
  userId: number,
  ids: number[],
): Promise<void> {
  const atuais = await listMeals(db, userId);
  if (atuais.length === 0) return;

  const rank = new Map<number, number>();
  ids.forEach((id, i) => rank.set(id, i));
  let proximo = ids.length;
  for (const m of atuais) if (!rank.has(m.id)) rank.set(m.id, proximo++);

  const ordenadas = [...atuais].sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  await db.batch(
    ordenadas.map((m, i) => ({
      sql: "UPDATE meals SET ordem=? WHERE id=? AND user_id=?",
      args: [i + 1, m.id, userId] as (number | string | null)[],
    })),
    "write",
  );
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
