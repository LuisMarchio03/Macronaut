import type { Client } from "@libsql/client";
import type { MedidasDeAlimento } from "./build-medidas.ts";

/**
 * Importa `src/data/medidas.json` para `food_measures`. Idempotente por
 * (food_id, nome, pof_codigo) — NÃO por (food_id, nome). Enquanto candidato, o
 * alimento tem várias medidas de mesmo nome (uma por candidato POF, gramas
 * diferentes); dedupar por nome só descartaria 73% delas. Nunca sobrescreve
 * medida manual do usuário (item 4 do spec: nada é deletado nem reescrito).
 *
 * Alimentos com status 'candidata' entram com TODAS as medidas de TODOS os
 * candidatos. O usuário desambigua na 1ª vez que registrar o alimento, e aí
 * as do candidato escolhido viram 'confirmada' e as demais 'descartada'.
 */
export async function semearMedidas(db: Client, medidas: MedidasDeAlimento[]): Promise<number> {
  let inseridas = 0;

  for (const m of medidas) {
    const food = await db.execute({
      sql: "SELECT id FROM foods WHERE nome=? AND source='taco' LIMIT 1",
      args: [m.alimento],
    });
    if (food.rows.length === 0) continue;
    const foodId = food.rows[0].id as number;

    const existentes = await db.execute({
      sql: "SELECT nome, source, pof_codigo FROM food_measures WHERE food_id=?",
      args: [foodId],
    });

    // Medida do usuário sempre ganha: se ele já criou "concha" à mão, nenhuma
    // "concha" da POF entra (item 4 do spec — não reescrevemos o que é dele).
    const nomesManuais = new Set(
      existentes.rows.filter((r) => r.source === "manual").map((r) => r.nome as string),
    );

    // Idempotência por (nome, pof_codigo) — NÃO por nome só.
    //
    // Enquanto o alimento é candidato, "concha" existe uma vez POR CANDIDATO:
    // FEIJAO CARIOCA tem concha=140g e FEIJAO TROPEIRO tem concha=35g. Dedupar
    // por nome faria a 2ª sumir, e aí escolher "tropeiro" na desambiguação
    // devolveria a concha do carioca — o mesmo erro silencioso que a chave
    // composta existe para matar, um nível abaixo. Medido: dedupar por nome
    // descartava 18.268 das 24.838 medidas (73,5%), e os 313 alimentos
    // candidatos TODOS tinham colisão.
    //
    // A unicidade por nome não é responsabilidade do seed: ela aparece quando
    // o usuário desambigua e `resolverCandidatas` (Task 9) marca as medidas dos
    // candidatos rejeitados como 'descartada' — que `listMeasures` já filtra.
    const jaSemeadas = new Set(
      existentes.rows
        .filter((r) => r.source === "pof")
        .map((r) => `${r.nome as string}|${r.pof_codigo as string}`),
    );

    let ordem = existentes.rows.length;
    const stmts: { sql: string; args: (number | string)[] }[] = [];
    for (const cand of m.candidatos) {
      for (const medida of cand.medidas) {
        if (nomesManuais.has(medida.nome)) continue;
        const chave = `${medida.nome}|${medida.pof_codigo}`;
        if (jaSemeadas.has(chave)) continue;
        jaSemeadas.add(chave);
        stmts.push({
          sql: `INSERT INTO food_measures (food_id, nome, qty_base, ordem, source, status, pof_codigo, pof_descricao)
                VALUES (?, ?, ?, ?, 'pof', ?, ?, ?)`,
          args: [foodId, medida.nome, medida.qty_base, ordem++, m.status, medida.pof_codigo, cand.pof_descricao],
        });
      }
    }
    if (stmts.length > 0) {
      await db.batch(stmts, "write");
      inseridas += stmts.length;
    }
  }

  return inseridas;
}
