import type { Client, Row } from "@libsql/client";
import type { FoodEntry, MealTemplate, MealTemplateItem, MealTemplateWithKcal } from "../domain/types";

function mapTemplate(r: Row): MealTemplate {
  return {
    id: r.id as number,
    nome: r.nome as string,
    meal_id: (r.meal_id as number | null) ?? null,
    created_at: r.created_at as string,
  };
}

function mapItem(r: Row): MealTemplateItem {
  return {
    id: r.id as number,
    template_id: r.template_id as number,
    food_id: r.food_id as number,
    qty_g: r.qty_g as number,
    measure_id: (r.measure_id as number | null) ?? null,
    measure_count: (r.measure_count as number | null) ?? null,
    ordem: r.ordem as number,
  };
}

/**
 * `mealId` filtra por refeição. Templates com `meal_id` NULL aparecem em
 * TODAS: `meal_id` sugere onde a favorita é oferecida, não restringe onde
 * pode ser aplicada (ver schema).
 */
export async function listTemplates(
  db: Client,
  userId: number,
  mealId?: number | null,
): Promise<MealTemplate[]> {
  if (mealId === undefined) {
    const rs = await db.execute({
      sql: "SELECT * FROM meal_templates WHERE user_id=? ORDER BY nome",
      args: [userId],
    });
    return rs.rows.map(mapTemplate);
  }
  const rs = await db.execute({
    sql: `SELECT * FROM meal_templates
          WHERE user_id=? AND (meal_id IS NULL OR meal_id=?)
          ORDER BY nome`,
    args: [userId, mealId],
  });
  return rs.rows.map(mapTemplate);
}

export async function listTemplatesWithKcal(
  db: Client,
  userId: number,
  mealId?: number | null,
): Promise<MealTemplateWithKcal[]> {
  const sql = `SELECT t.id, t.nome, t.meal_id, t.created_at,
                      COALESCE(ROUND(SUM((ti.qty_g * f.kcal) / f.base_qty_g)), 0) as total_kcal
               FROM meal_templates t
               LEFT JOIN meal_template_items ti ON ti.template_id = t.id
               LEFT JOIN foods f ON f.id = ti.food_id
               WHERE t.user_id=?${mealId !== undefined ? " AND (t.meal_id IS NULL OR t.meal_id=?)" : ""}
               GROUP BY t.id
               ORDER BY t.nome`;
  const args: (number | string | null)[] = [userId];
  if (mealId !== undefined) args.push(mealId);
  const rs = await db.execute({ sql, args });
  return rs.rows.map((r) => ({
    id: r.id as number,
    nome: r.nome as string,
    meal_id: (r.meal_id as number | null) ?? null,
    created_at: r.created_at as string,
    total_kcal: r.total_kcal as number,
  }));
}

export async function listTemplateItems(db: Client, templateId: number): Promise<MealTemplateItem[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM meal_template_items WHERE template_id=? ORDER BY ordem",
    args: [templateId],
  });
  return rs.rows.map(mapItem);
}

/**
 * Snapshot de uma refeição registrada. Copia qty_g E measure_id/measure_count:
 * a favorita guarda a INTENÇÃO ("2 fatias"), e é por isso que `aplicar`
 * recalcula a grama a partir da medida atual.
 *
 * Snapshot em vez de ponteiro para o histórico porque o usuário pode deletar
 * as entries de origem (`deleteEntry` existe) — o ponteiro ficaria órfão.
 */
export async function criarDeEntries(
  db: Client,
  userId: number,
  nome: string,
  mealId: number | null,
  entries: FoodEntry[],
): Promise<MealTemplate> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: "INSERT INTO meal_templates (user_id, nome, meal_id, created_at) VALUES (?, ?, ?, ?)",
    args: [userId, nome, mealId, created_at],
  });
  const id = Number(rs.lastInsertRowid);

  if (entries.length > 0) {
    await db.batch(
      entries.map((e, i) => ({
        sql: `INSERT INTO meal_template_items (template_id, food_id, qty_g, measure_id, measure_count, ordem)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, e.food_id, e.qty_g, e.measure_id, e.measure_count, i],
      })),
      "write",
    );
  }

  return { id, nome, meal_id: mealId, created_at };
}

/**
 * Registra os itens da favorita em `data`/`mealId`.
 *
 * A grama é RECALCULADA a partir da medida atual quando o item tem medida: se
 * a fatia foi corrigida de 25 g para 28 g, "2 fatias" passa a registrar 56 g.
 * O histórico já gravado NÃO muda — só o que se registra daqui pra frente.
 */
export async function aplicar(
  db: Client,
  userId: number,
  templateId: number,
  data: string,
  mealId: number | null,
): Promise<number> {
  const itens = await listTemplateItems(db, templateId);
  if (itens.length === 0) return 0;

  const measureIds = [...new Set(itens.map((i) => i.measure_id).filter((x): x is number => x != null))];
  const pesos = new Map<number, number>();
  if (measureIds.length > 0) {
    const rs = await db.execute({
      sql: `SELECT id, qty_base FROM food_measures
            WHERE id IN (${measureIds.map(() => "?").join(",")}) AND status != 'descartada'`,
      args: measureIds,
    });
    for (const r of rs.rows) pesos.set(r.id as number, r.qty_base as number);
  }

  const created_at = new Date().toISOString();
  await db.batch(
    itens.map((i) => {
      const peso = i.measure_id != null ? pesos.get(i.measure_id) : undefined;
      // Sem medida (ou medida descartada): usa a grama do snapshot.
      const qty_g = peso != null && i.measure_count != null ? peso * i.measure_count : i.qty_g;
      const measure_id = peso != null ? i.measure_id : null;
      const measure_count = peso != null ? i.measure_count : null;
      return {
        sql: `INSERT INTO food_entries (user_id, data, meal_id, food_id, qty_g,
                                        measure_id, measure_count, label, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [userId, data, mealId, i.food_id, qty_g, measure_id, measure_count,
               mealId === null ? "Avulsa" : null, created_at],
      };
    }),
    "write",
  );

  return itens.length;
}

/** Deleta a favorita (itens vão por cascade). Não toca no histórico já registrado. */
export async function deleteTemplate(db: Client, userId: number, id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM meal_templates WHERE id=? AND user_id=?",
    args: [id, userId],
  });
}
