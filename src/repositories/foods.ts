import type { Client, Row } from "@libsql/client";
// Com extensão: este módulo é alcançado por `scripts/setup-db.ts`, que roda no
// Node com --experimental-strip-types, e lá o import extensionless não resolve.
// O Vite e o Vitest resolvem os dois, então a falha só aparece no `db:setup`.
import { normalizar } from "../domain/texto.ts";
import type { Food } from "../domain/types";

function mapRow(r: Row): Food {
  return {
    id: r.id as number,
    nome: r.nome as string,
    source: r.source as Food["source"],
    marca: (r.marca as string | null) ?? null,
    base_qty_g: r.base_qty_g as number,
    base_unit: r.base_unit as Food["base_unit"],
    default_measure_id: (r.default_measure_id as number | null) ?? null,
    kcal: r.kcal as number,
    prot_g: r.prot_g as number,
    carb_g: r.carb_g as number,
    gord_g: r.gord_g as number,
    fibra_g: (r.fibra_g as number | null) ?? null,
    sodio_mg: (r.sodio_mg as number | null) ?? null,
    categoria: (r.categoria as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

/**
 * Busca por nome, sem acento e sem caixa.
 *
 * Passa por `nome_norm`, não por `nome`: `COLLATE NOCASE` do SQLite só é
 * insensível a caixa em ASCII, então "acucar" não achava "Açúcar" e nem
 * "AÇÚCAR" achava "açúcar" — numa base cujos 590 nomes vêm da TACO, toda
 * acentuada, isso é não achar e cadastrar de novo o que já existe.
 *
 * O `OR nome LIKE` é a rede: linha gravada antes da coluna existir tem
 * `nome_norm` NULL e continua encontrável pelo nome cru.
 */
export async function searchFoods(db: Client, termo: string, limite = 30): Promise<Food[]> {
  const alvo = `%${normalizar(termo)}%`;
  const rs = await db.execute({
    sql: `SELECT * FROM foods
          WHERE nome_norm LIKE ? OR (nome_norm IS NULL AND nome LIKE ? COLLATE NOCASE)
          ORDER BY nome LIMIT ?`,
    args: [alvo, `%${termo}%`, limite],
  });
  return rs.rows.map(mapRow);
}

/**
 * Preenche `nome_norm` onde ainda está NULL. Idempotente; devolve quantos
 * foram preenchidos. Roda no `db:setup`, depois da importação da TACO.
 */
export async function backfillNomeNorm(db: Client): Promise<number> {
  const rs = await db.execute("SELECT id, nome FROM foods WHERE nome_norm IS NULL");
  if (rs.rows.length === 0) return 0;
  await db.batch(
    rs.rows.map((r) => ({
      sql: "UPDATE foods SET nome_norm=? WHERE id=? AND nome_norm IS NULL",
      args: [normalizar(r.nome as string), r.id as number] as (string | number)[],
    })),
    "write",
  );
  return rs.rows.length;
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
    sql: `INSERT INTO foods (nome, nome_norm, source, marca, base_qty_g, base_unit, default_measure_id,
                             kcal, prot_g, carb_g, gord_g, fibra_g, sodio_mg, categoria, created_at)
          VALUES (?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      f.nome, normalizar(f.nome), f.marca, f.base_qty_g, f.base_unit, f.default_measure_id,
      f.kcal, f.prot_g, f.carb_g, f.gord_g, f.fibra_g, f.sodio_mg, f.categoria, created_at,
    ],
  });
  return { id: Number(rs.lastInsertRowid), source: "custom", created_at, ...f };
}

export async function updateFood(
  db: Client,
  id: number,
  f: Omit<Food, "id" | "source" | "created_at">,
): Promise<void> {
  await db.execute({
    sql: `UPDATE foods SET nome=?, nome_norm=?, marca=?, base_qty_g=?, base_unit=?, default_measure_id=?,
                           kcal=?, prot_g=?, carb_g=?, gord_g=?, fibra_g=?, sodio_mg=?, categoria=?
          WHERE id=? AND source='custom'`,
    args: [
      f.nome, normalizar(f.nome), f.marca, f.base_qty_g, f.base_unit, f.default_measure_id,
      f.kcal, f.prot_g, f.carb_g, f.gord_g, f.fibra_g, f.sodio_mg, f.categoria, id,
    ],
  });
}

export async function deleteFood(db: Client, id: number): Promise<void> {
  await db.execute({ sql: "DELETE FROM foods WHERE id=? AND source='custom'", args: [id] });
}

/**
 * As categorias que a base de fato usa, em ordem alfabética.
 *
 * Derivadas dos alimentos e não de uma lista fixa: elas vêm da TACO
 * ("Cereais e derivados", "Pescados e frutos do mar"), e uma constante no
 * código divergiria do banco na primeira importação diferente.
 */
export async function listCategorias(db: Client): Promise<string[]> {
  const rs = await db.execute(
    "SELECT DISTINCT categoria FROM foods WHERE categoria IS NOT NULL ORDER BY categoria",
  );
  return rs.rows.map((r) => r.categoria as string);
}

/**
 * A base inteira, para navegar — não só a busca.
 *
 * A tela de alimentos só listava `source='custom'`, então quem nunca cadastrou
 * nada via um estado vazio enquanto 590 alimentos da TACO, já categorizados,
 * existiam no banco e só eram alcançáveis por dentro do autocomplete de
 * registro. Catálogo que não dá para folhear não é catálogo.
 */
export async function listFoods(
  db: Client,
  filtro: { termo?: string; categoria?: string; apenasMeus?: boolean; limite?: number } = {},
): Promise<Food[]> {
  const { termo = "", categoria = "", apenasMeus = false, limite = 200 } = filtro;
  const condicoes: string[] = [];
  const args: (string | number)[] = [];

  if (termo.trim() !== "") {
    condicoes.push("(nome_norm LIKE ? OR (nome_norm IS NULL AND nome LIKE ? COLLATE NOCASE))");
    args.push(`%${normalizar(termo)}%`, `%${termo}%`);
  }
  if (categoria !== "") {
    condicoes.push("categoria = ?");
    args.push(categoria);
  }
  if (apenasMeus) condicoes.push("source = 'custom'");

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
  args.push(limite);

  const rs = await db.execute({
    // Os seus primeiro: você cadastrou porque a TACO não tinha, então é o que
    // você procura quando digita o nome dele.
    sql: `SELECT * FROM foods ${where}
          ORDER BY CASE source WHEN 'custom' THEN 0 ELSE 1 END, nome
          LIMIT ?`,
    args,
  });
  return rs.rows.map(mapRow);
}

export async function listCustomFoods(db: Client): Promise<Food[]> {
  const rs = await db.execute("SELECT * FROM foods WHERE source='custom' ORDER BY nome");
  return rs.rows.map(mapRow);
}
