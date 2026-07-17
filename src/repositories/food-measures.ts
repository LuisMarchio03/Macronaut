import type { Client, Row } from "@libsql/client";
import type { FoodMeasure, SourceMedida, StatusMedida } from "../domain/types";

function mapRow(r: Row): FoodMeasure {
  return {
    id: r.id as number,
    food_id: r.food_id as number,
    nome: r.nome as string,
    qty_base: r.qty_base as number,
    ordem: r.ordem as number,
    source: r.source as SourceMedida,
    status: r.status as StatusMedida,
    pof_codigo: (r.pof_codigo as string | null) ?? null,
    pof_descricao: (r.pof_descricao as string | null) ?? null,
  };
}

/** Medidas utilizáveis: descartadas ficam no banco (item 4) mas fora da UI. */
export async function listMeasures(db: Client, foodId: number): Promise<FoodMeasure[]> {
  const rs = await db.execute({
    sql: `SELECT * FROM food_measures
          WHERE food_id=? AND status != 'descartada'
          ORDER BY ordem, nome`,
    args: [foodId],
  });
  return rs.rows.map(mapRow);
}

export async function listMeasuresByFoodIds(
  db: Client,
  foodIds: number[],
): Promise<Map<number, FoodMeasure[]>> {
  if (foodIds.length === 0) return new Map();
  const placeholders = foodIds.map(() => "?").join(",");
  const rs = await db.execute({
    sql: `SELECT * FROM food_measures
          WHERE food_id IN (${placeholders}) AND status != 'descartada'
          ORDER BY ordem, nome`,
    args: foodIds,
  });
  const mapa = new Map<number, FoodMeasure[]>();
  for (const r of rs.rows) {
    const m = mapRow(r);
    const lista = mapa.get(m.food_id);
    if (lista) lista.push(m);
    else mapa.set(m.food_id, [m]);
  }
  return mapa;
}

export async function createMeasure(
  db: Client,
  m: Omit<FoodMeasure, "id">,
): Promise<FoodMeasure> {
  const rs = await db.execute({
    sql: `INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [m.food_id, m.nome, m.qty_base, m.ordem, m.source, m.status, m.pof_codigo, m.pof_descricao],
  });
  return { id: Number(rs.lastInsertRowid), ...m };
}

export async function updateMeasure(
  db: Client,
  id: number,
  campos: { nome?: string; qty_base?: number; ordem?: number },
): Promise<void> {
  const sets: string[] = [];
  const args: (number | string)[] = [];
  if (campos.nome !== undefined) { sets.push("nome=?"); args.push(campos.nome); }
  if (campos.qty_base !== undefined) { sets.push("qty_base=?"); args.push(campos.qty_base); }
  if (campos.ordem !== undefined) { sets.push("ordem=?"); args.push(campos.ordem); }
  if (sets.length === 0) return;
  args.push(id);
  // `AND source='manual'`, simétrico a deleteMeasure: medida da POF é dado
  // importado (item 4). Editar o qty_base de uma medida da POF reescreveria a
  // fonte E deslocaria em silêncio toda favorita que recalcula daquele peso.
  await db.execute({ sql: `UPDATE food_measures SET ${sets.join(", ")} WHERE id=? AND source='manual'`, args });
}

/** Só medida manual é deletável: a da POF é dado importado, não do usuário. */
export async function deleteMeasure(db: Client, id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM food_measures WHERE id=? AND source='manual'",
    args: [id],
  });
}

export async function temCandidatas(db: Client, foodId: number): Promise<boolean> {
  const rs = await db.execute({
    sql: "SELECT 1 FROM food_measures WHERE food_id=? AND status='candidata' LIMIT 1",
    args: [foodId],
  });
  return rs.rows.length > 0;
}

/** Os candidatos POF pendentes, agrupados por código — a pergunta da desambiguação. */
export async function listCandidatos(
  db: Client,
  foodId: number,
): Promise<{ pof_codigo: string; pof_descricao: string | null; medidas: FoodMeasure[] }[]> {
  const rs = await db.execute({
    sql: `SELECT * FROM food_measures
          WHERE food_id=? AND status='candidata'
          ORDER BY pof_codigo, ordem, nome`,
    args: [foodId],
  });
  const mapa = new Map<string, FoodMeasure[]>();
  for (const r of rs.rows) {
    const m = mapRow(r);
    const k = m.pof_codigo ?? "";
    const lista = mapa.get(k);
    if (lista) lista.push(m);
    else mapa.set(k, [m]);
  }
  // A descrição é a mesma em todas as medidas de um candidato (vêm da mesma
  // linha-alimento da POF); pega da primeira.
  return [...mapa.entries()].map(([pof_codigo, medidas]) => ({
    pof_codigo,
    pof_descricao: medidas[0]?.pof_descricao ?? null,
    medidas,
  }));
}

/**
 * Resolve a ambiguidade de ALIMENTO (não de medida): o usuário disse qual
 * registro da POF corresponde a este alimento da TACO. As medidas do escolhido
 * viram 'confirmada'; as dos demais candidatos viram 'descartada'.
 *
 * `pofCodigoEscolhido = null` → "nenhum destes": descarta todas, e o alimento
 * cai no fallback de gramas.
 *
 * NUNCA deleta (item 4 do spec) e nunca toca em `source='manual'`: medida que
 * o usuário criou é dele.
 */
export async function resolverCandidatas(
  db: Client,
  foodId: number,
  pofCodigoEscolhido: string | null,
): Promise<void> {
  // Os dois UPDATEs só tocam linhas 'candidata', e a ORDEM importa: confirmar
  // ANTES de descartar.
  //   1. confirma: o candidato escolhido vira 'confirmada' (some do filtro).
  //   2. descarta: o que ainda for 'candidata' (os outros) vira 'descartada'.
  // Se descartasse primeiro, o passo 1 não acharia mais nenhum 'candidata' e o
  // escolhido ficaria descartado junto.
  //
  // O filtro `status='candidata'` na confirmação é o que dá idempotência e
  // resistência a "mudar de ideia": resolvido uma vez, não há mais 'candidata',
  // então uma 2ª chamada com escolha diferente é no-op — não ressuscita uma
  // medida já 'descartada' de volta para 'confirmada'.
  const stmts: { sql: string; args: (number | string)[] }[] = [];
  if (pofCodigoEscolhido !== null) {
    stmts.push({
      sql: `UPDATE food_measures SET status='confirmada'
            WHERE food_id=? AND pof_codigo=? AND status='candidata' AND source='pof'`,
      args: [foodId, pofCodigoEscolhido],
    });
  }
  stmts.push({
    sql: `UPDATE food_measures SET status='descartada'
          WHERE food_id=? AND status='candidata' AND source='pof'`,
    args: [foodId],
  });
  await db.batch(stmts, "write");
}
