import type { Client } from "@libsql/client";

export type TacoItem = {
  nome: string;
  base_qty_g: number;
  kcal: number;
  prot_g: number;
  carb_g: number;
  gord_g: number;
  fibra_g?: number | null;
  sodio_mg?: number | null;
  categoria?: string;
};

export async function importarTaco(db: Client, itens: TacoItem[]): Promise<number> {
  const created_at = new Date().toISOString();
  let inseridos = 0;
  for (const it of itens) {
    const existe = await db.execute({
      sql: "SELECT 1 FROM foods WHERE nome=? AND source='taco' LIMIT 1",
      args: [it.nome],
    });
    if (existe.rows.length) continue;
    await db.execute({
      sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g,
                               fibra_g, sodio_mg, categoria, created_at)
            VALUES (?, 'taco', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        it.nome, it.base_qty_g ?? 100, it.kcal ?? 0, it.prot_g ?? 0, it.carb_g ?? 0,
        it.gord_g ?? 0, it.fibra_g ?? null, it.sodio_mg ?? null, it.categoria ?? null,
        created_at,
      ],
    });
    inseridos++;
  }
  return inseridos;
}

/**
 * Preenche fibra/sódio/categoria nas linhas da TACO que já existiam antes de
 * essas colunas serem criadas. `importarTaco` sozinho não resolve: ele é
 * idempotente por PULAR o que já existe, então num banco legado as 597 linhas
 * ficariam NULL para sempre.
 *
 * Irmão de `backfillGrupos`/`backfillUserIds` (src/repositories/exercises.ts),
 * que existem pela mesma razão do lado dos exercícios.
 *
 * Só toca em `source='taco'` (alimento do usuário é dele) e só onde está NULL
 * (não sobrescreve correção manual) — o que também o torna idempotente.
 */
export async function backfillNutrientes(db: Client, itens: TacoItem[]): Promise<number> {
  const stmts: { sql: string; args: Record<string, number | string | null> }[] = [];
  for (const it of itens) {
    if (it.fibra_g == null && it.sodio_mg == null && it.categoria == null) continue;
    stmts.push({
      // COALESCE protege COLUNA A COLUNA: cada campo só é preenchido se estiver
      // NULL. Um `SET fibra=?, sodio=?` cru sobrescreveria correção manual sua,
      // e um `WHERE (fibra IS NULL AND sodio IS NULL AND categoria IS NULL)`
      // travaria o preenchimento de qualquer estado parcial para sempre.
      //
      // O WHERE pergunta "tem algo pra preencher?", não "falta algo?". A
      // diferença importa: 37% dos alimentos da TACO têm fibra desconhecida
      // (NA), que fica NULL de propósito. Um WHERE com `fibra_g IS NULL OR ...`
      // casaria neles em TODA rodada e o backfill nunca seria idempotente.
      sql: `UPDATE foods
               SET fibra_g   = COALESCE(fibra_g,   :fibra),
                   sodio_mg  = COALESCE(sodio_mg,  :sodio),
                   categoria = COALESCE(categoria, :categoria)
             WHERE nome = :nome AND source = 'taco'
               AND (  (fibra_g   IS NULL AND :fibra     IS NOT NULL)
                   OR (sodio_mg  IS NULL AND :sodio     IS NOT NULL)
                   OR (categoria IS NULL AND :categoria IS NOT NULL) )`,
      args: {
        fibra: it.fibra_g ?? null,
        sodio: it.sodio_mg ?? null,
        categoria: it.categoria ?? null,
        nome: it.nome,
      },
    });
  }
  if (stmts.length === 0) return 0;
  const rss = await db.batch(stmts, "write");
  return rss.reduce((s, rs) => s + rs.rowsAffected, 0);
}
