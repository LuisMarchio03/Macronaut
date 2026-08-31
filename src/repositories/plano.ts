import type { Client, Row } from "@libsql/client";
// Com extensão: este módulo é alcançado por `scripts/setup-db.ts` (a migração
// das trocas de bloco), que roda no Node com --experimental-strip-types, e lá o
// import extensionless não resolve. Vite e Vitest resolvem os dois, então a
// falha só apareceria no `db:setup`.
import { itensResolvidos } from "../domain/plano-dia.ts";
import { normalizar } from "../domain/texto.ts";
import type {
  CategoriaItem,
  DietPlan,
  PlanBlock,
  PlanCheck,
  PlanItem,
  PlanMacro,
  PlanSwap,
  RascunhoPlano,
  TipoBloco,
  TrocaDeItem,
} from "../domain/plano-types";

/* ── mapeamento ─────────────────────────────────────────────────── */

function mapPlan(r: Row): DietPlan {
  return {
    id: r.id as number,
    nome: r.nome as string,
    origem: r.origem as DietPlan["origem"],
    kcal_min: (r.kcal_min as number | null) ?? null,
    kcal_max: (r.kcal_max as number | null) ?? null,
    prot_alvo_g: (r.prot_alvo_g as number | null) ?? null,
    agua_ml_alvo: (r.agua_ml_alvo as number | null) ?? null,
    ativo: Boolean(r.ativo),
    created_at: r.created_at as string,
  };
}

function mapBlock(r: Row): PlanBlock {
  return {
    id: r.id as number,
    plan_id: r.plan_id as number,
    tipo: r.tipo as TipoBloco,
    nome: r.nome as string,
    hora_inicio: (r.hora_inicio as string | null) ?? null,
    hora_fim: (r.hora_fim as string | null) ?? null,
    ancora: (r.ancora as string | null) ?? null,
    kcal_alvo: (r.kcal_alvo as number | null) ?? null,
    ml_alvo: (r.ml_alvo as number | null) ?? null,
    observacao: (r.observacao as string | null) ?? null,
    ordem: r.ordem as number,
  };
}

function mapItem(r: Row): PlanItem {
  return {
    id: r.id as number,
    block_id: r.block_id as number,
    texto: r.texto as string,
    categoria: (r.categoria as CategoriaItem | null) ?? null,
    food_id: (r.food_id as number | null) ?? null,
    qty_g: (r.qty_g as number | null) ?? null,
    ordem: r.ordem as number,
  };
}

function mapSwap(r: Row): PlanSwap {
  return {
    id: r.id as number,
    plan_id: r.plan_id as number,
    block_nome: r.block_nome as string,
    categoria: r.categoria as string,
    alimento: r.alimento as string,
    porcao: r.porcao as string,
    qty_g: (r.qty_g as number | null) ?? null,
    kcal: r.kcal as number,
    food_id: (r.food_id as number | null) ?? null,
  };
}

function mapCheck(r: Row): PlanCheck {
  return {
    id: r.id as number,
    user_id: r.user_id as number,
    plan_id: r.plan_id as number,
    data: r.data as string,
    block_id: r.block_id as number,
    feito: Boolean(r.feito),
    swap_id: (r.swap_id as number | null) ?? null,
    created_at: r.created_at as string,
  };
}

/* ── leitura ────────────────────────────────────────────────────── */

export async function getPlanoAtivo(db: Client, userId: number): Promise<DietPlan | null> {
  const rs = await db.execute({
    sql: "SELECT * FROM diet_plans WHERE user_id=? AND ativo=1 ORDER BY id DESC LIMIT 1",
    args: [userId],
  });
  return rs.rows[0] ? mapPlan(rs.rows[0]) : null;
}

export async function listPlanos(db: Client, userId: number): Promise<DietPlan[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM diet_plans WHERE user_id=? ORDER BY ativo DESC, id DESC",
    args: [userId],
  });
  return rs.rows.map(mapPlan);
}

/**
 * Blocos ordenados como o dia acontece: quem tem horário vem antes, na ordem
 * do relógio; quem é ancorado a um evento ("Após almoço") vai para o fim, na
 * ordem em que aparecia na planilha.
 *
 * A ordenação sai do SQL para que a tela não tenha que reordenar a cada render
 * e para que o critério viva num lugar só.
 */
export async function listBlocos(db: Client, planId: number): Promise<PlanBlock[]> {
  const rs = await db.execute({
    sql: `SELECT * FROM plan_blocks
          WHERE plan_id=?
          ORDER BY (hora_inicio IS NULL), hora_inicio, ordem`,
    args: [planId],
  });
  return rs.rows.map(mapBlock);
}

/** Itens de todos os blocos do plano, agrupados por `block_id`. */
export async function listItensPorBloco(
  db: Client,
  planId: number,
): Promise<Map<number, PlanItem[]>> {
  const rs = await db.execute({
    sql: `SELECT i.* FROM plan_items i
          JOIN plan_blocks b ON b.id = i.block_id
          WHERE b.plan_id=?
          ORDER BY i.block_id, i.ordem`,
    args: [planId],
  });
  const out = new Map<number, PlanItem[]>();
  for (const r of rs.rows) {
    const item = mapItem(r);
    const lista = out.get(item.block_id);
    if (lista) lista.push(item);
    else out.set(item.block_id, [item]);
  }
  return out;
}

export async function listMacros(db: Client, planId: number): Promise<PlanMacro[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM plan_macros WHERE plan_id=? ORDER BY id",
    args: [planId],
  });
  return rs.rows.map((r) => ({
    id: r.id as number,
    plan_id: r.plan_id as number,
    block_nome: r.block_nome as string,
    prot_g: r.prot_g as number,
    carb_g: r.carb_g as number,
    gord_g: r.gord_g as number,
    kcal: r.kcal as number,
  }));
}

export async function listSubstituicoes(db: Client, planId: number): Promise<PlanSwap[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM plan_swaps WHERE plan_id=? ORDER BY block_nome, categoria, kcal",
    args: [planId],
  });
  return rs.rows.map(mapSwap);
}

export async function listChecksDoDia(
  db: Client,
  userId: number,
  data: string,
): Promise<PlanCheck[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM plan_checks WHERE user_id=? AND data=?",
    args: [userId, data],
  });
  return rs.rows.map(mapCheck);
}

/** Quantos blocos de refeição foram cumpridos em cada dia do intervalo. */
export async function contarChecksPorDia(
  db: Client,
  userId: number,
  inicio: string,
  fim: string,
): Promise<Map<string, number>> {
  const rs = await db.execute({
    sql: `SELECT c.data, COUNT(*) AS n
          FROM plan_checks c
          JOIN plan_blocks b ON b.id = c.block_id
          WHERE c.user_id=? AND c.feito=1 AND b.tipo='refeicao'
            AND c.data BETWEEN ? AND ?
          GROUP BY c.data`,
    args: [userId, inicio, fim],
  });
  return new Map(rs.rows.map((r) => [r.data as string, r.n as number]));
}

/* ── escrita ────────────────────────────────────────────────────── */

/**
 * Grava um plano novo e o torna o ativo.
 *
 * O plano anterior é DESATIVADO, não apagado: `plan_checks` aponta para os
 * blocos dele, e apagar reescreveria o histórico de aderência de quem trocou
 * de dieta.
 */
export async function importarPlano(
  db: Client,
  userId: number,
  rascunho: RascunhoPlano,
  origem: DietPlan["origem"],
): Promise<DietPlan> {
  const created_at = new Date().toISOString();

  await db.execute({
    sql: "UPDATE diet_plans SET ativo=0 WHERE user_id=? AND ativo=1",
    args: [userId],
  });

  const rs = await db.execute({
    sql: `INSERT INTO diet_plans
            (user_id, nome, origem, kcal_min, kcal_max, prot_alvo_g, agua_ml_alvo, ativo, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    args: [
      userId,
      rascunho.meta.nome,
      origem,
      rascunho.meta.kcal_min,
      rascunho.meta.kcal_max,
      rascunho.meta.prot_alvo_g,
      rascunho.meta.agua_ml_alvo,
      created_at,
    ],
  });
  const planId = Number(rs.lastInsertRowid);

  for (const [ordem, bloco] of rascunho.blocos.entries()) {
    const rb = await db.execute({
      sql: `INSERT INTO plan_blocks
              (plan_id, tipo, nome, hora_inicio, hora_fim, ancora, kcal_alvo, ml_alvo, observacao, ordem)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        planId,
        bloco.tipo,
        bloco.nome,
        bloco.hora_inicio,
        bloco.hora_fim,
        bloco.ancora,
        bloco.kcal_alvo,
        bloco.ml_alvo,
        bloco.observacao,
        ordem,
      ],
    });
    const blockId = Number(rb.lastInsertRowid);

    if (bloco.itens.length > 0) {
      await db.batch(
        bloco.itens.map((item, i) => ({
          sql: `INSERT INTO plan_items (block_id, texto, categoria, food_id, qty_g, ordem)
                VALUES (?, ?, ?, NULL, NULL, ?)`,
          args: [blockId, item.texto, item.categoria, i],
        })),
        "write",
      );
    }
  }

  if (rascunho.macros.length > 0) {
    await db.batch(
      rascunho.macros.map((m) => ({
        sql: `INSERT INTO plan_macros (plan_id, block_nome, prot_g, carb_g, gord_g, kcal)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [planId, m.block_nome, m.prot_g, m.carb_g, m.gord_g, m.kcal],
      })),
      "write",
    );
  }

  if (rascunho.substituicoes.length > 0) {
    await db.batch(
      rascunho.substituicoes.map((s) => ({
        sql: `INSERT INTO plan_swaps (plan_id, block_nome, categoria, alimento, porcao, qty_g, kcal, food_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        args: [planId, s.block_nome, s.categoria, s.alimento, s.porcao, s.qty_g, s.kcal],
      })),
      "write",
    );
  }

  return {
    id: planId,
    nome: rascunho.meta.nome,
    origem,
    kcal_min: rascunho.meta.kcal_min,
    kcal_max: rascunho.meta.kcal_max,
    prot_alvo_g: rascunho.meta.prot_alvo_g,
    agua_ml_alvo: rascunho.meta.agua_ml_alvo,
    ativo: true,
    created_at,
  };
}

export async function ativarPlano(db: Client, userId: number, planId: number): Promise<void> {
  await db.batch(
    [
      { sql: "UPDATE diet_plans SET ativo=0 WHERE user_id=?", args: [userId] },
      { sql: "UPDATE diet_plans SET ativo=1 WHERE id=? AND user_id=?", args: [planId, userId] },
    ],
    "write",
  );
}

export async function deletarPlano(db: Client, userId: number, planId: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM diet_plans WHERE id=? AND user_id=?",
    args: [planId, userId],
  });
}

/* ── troca por item ─────────────────────────────────────────────── */

/**
 * Uma linha de `plan_item_swaps` já resolvida para a tela.
 *
 * O nome e a porção moram em tabelas diferentes conforme a origem — em
 * `plan_swaps` quando a troca é prevista no plano, em `foods` quando é do
 * catálogo, na própria linha quando foi escrita à mão. O join sai daqui uma
 * vez, e não de cada tela que desenha uma troca.
 */
function mapTroca(r: Row): TrocaDeItem {
  const swapId = (r.swap_id as number | null) ?? null;
  const foodProprio = (r.food_id as number | null) ?? null;
  const texto = (r.texto as string | null) ?? null;

  const origem: TrocaDeItem["origem"] =
    swapId !== null ? "plano" : foodProprio !== null ? "catalogo" : "texto";

  const qty_g = (r.qty_g as number | null) ?? (r.swap_qty_g as number | null) ?? null;

  return {
    id: r.id as number,
    data: r.data as string,
    block_id: r.block_id as number,
    item_id: r.item_id as number,
    origem,
    swap_id: swapId,
    nome:
      (r.swap_alimento as string | null) ??
      (r.food_nome as string | null) ??
      texto ??
      "?",
    porcao:
      (r.swap_porcao as string | null) ??
      (qty_g !== null && foodProprio !== null ? `${qty_g} g` : null),
    kcal: (r.kcal as number | null) ?? (r.swap_kcal as number | null) ?? null,
    // O alimento efetivo: o do catálogo que você escolheu, ou o que o
    // importador conseguiu casar com a substituição do plano. Sem um dos dois
    // a troca é só texto na tela, e `itensResolvidos` a mantém fora do diário.
    food_id: foodProprio ?? (r.swap_food_id as number | null) ?? null,
    qty_g,
    measure_id: (r.measure_id as number | null) ?? null,
    medidas: (r.medidas as number | null) ?? null,
  };
}

const SELECT_TROCAS = `
  SELECT t.*,
         s.alimento AS swap_alimento, s.porcao AS swap_porcao,
         s.kcal AS swap_kcal, s.qty_g AS swap_qty_g, s.food_id AS swap_food_id,
         f.nome AS food_nome
  FROM plan_item_swaps t
  LEFT JOIN plan_swaps s ON s.id = t.swap_id
  LEFT JOIN foods f      ON f.id = t.food_id
  WHERE t.user_id = ? AND t.data = ?
  ORDER BY t.item_id`;

export async function listTrocasDoDia(
  db: Client,
  userId: number,
  data: string,
): Promise<TrocaDeItem[]> {
  const rs = await db.execute({ sql: SELECT_TROCAS, args: [userId, data] });
  return rs.rows.map(mapTroca);
}

export interface TrocaEntrada {
  data: string;
  block_id: number;
  item_id: number;
  /** Exatamente um dos três: o CHECK da tabela recusa uma linha ambígua. */
  swap_id?: number | null;
  food_id?: number | null;
  texto?: string | null;
  qty_g?: number | null;
  measure_id?: number | null;
  medidas?: number | null;
  kcal?: number | null;
}

/**
 * Grava a troca de um item, ou corrige a que já existia.
 *
 * `UNIQUE (user_id, data, item_id)` é o que faz "trocar de novo" ser uma
 * correção. O upsert zera as colunas da origem que não vieram nesta chamada —
 * senão trocar do catálogo para o plano deixaria as duas preenchidas e a linha
 * pararia de passar no CHECK na próxima escrita.
 */
export async function salvarTroca(
  db: Client,
  userId: number,
  e: TrocaEntrada,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO plan_item_swaps
            (user_id, data, block_id, item_id, swap_id, food_id, texto,
             qty_g, measure_id, medidas, kcal, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (user_id, data, item_id) DO UPDATE SET
            block_id   = excluded.block_id,
            swap_id    = excluded.swap_id,
            food_id    = excluded.food_id,
            texto      = excluded.texto,
            qty_g      = excluded.qty_g,
            measure_id = excluded.measure_id,
            medidas    = excluded.medidas,
            kcal       = excluded.kcal`,
    args: [
      userId, e.data, e.block_id, e.item_id,
      e.swap_id ?? null, e.food_id ?? null, e.texto ?? null,
      e.qty_g ?? null, e.measure_id ?? null, e.medidas ?? null, e.kcal ?? null,
      new Date().toISOString(),
    ],
  });
}

/**
 * Traz para `plan_item_swaps` as trocas gravadas no jeito antigo.
 *
 * `plan_checks.swap_id` guardava UMA troca por bloco, sem dizer qual linha da
 * refeição ela substituía. O item é reencontrado pela categoria do swap — que
 * é a mesma chave que a folha usa para oferecer a troca. Quando nenhum item do
 * bloco tem aquela categoria, a linha antiga é deixada onde está: a coluna
 * continua no banco, então nada é perdido.
 *
 * Idempotente, como os outros backfills do `setup-db`: item que já tem troca
 * naquele dia não é tocado. Devolve quantas linhas migrou.
 */
export async function migrarTrocasDeBloco(db: Client): Promise<number> {
  const rs = await db.execute(`
    SELECT c.user_id, c.data, c.block_id, c.swap_id, s.categoria
    FROM plan_checks c
    JOIN plan_swaps s ON s.id = c.swap_id
    WHERE c.swap_id IS NOT NULL`);

  let migradas = 0;
  for (const r of rs.rows) {
    const userId = r.user_id as number;
    const data = r.data as string;
    const blockId = r.block_id as number;
    const categoria = normalizar(r.categoria as string);

    const itens = await db.execute({
      sql: "SELECT id, categoria FROM plan_items WHERE block_id=? ORDER BY ordem",
      args: [blockId],
    });
    const alvo = itens.rows.find(
      (i) => i.categoria !== null && normalizar(i.categoria as string) === categoria,
    );
    if (!alvo) continue;

    const jaTem = await db.execute({
      sql: "SELECT 1 FROM plan_item_swaps WHERE user_id=? AND data=? AND item_id=?",
      args: [userId, data, alvo.id as number],
    });
    if (jaTem.rows.length) continue;

    await db.execute({
      sql: `INSERT INTO plan_item_swaps (user_id, data, block_id, item_id, swap_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, data, blockId, alvo.id as number, r.swap_id as number, new Date().toISOString()],
    });
    migradas++;
  }
  return migradas;
}

/** Devolve o item ao que o plano manda. */
export async function removerTroca(
  db: Client,
  userId: number,
  data: string,
  itemId: number,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM plan_item_swaps WHERE user_id=? AND data=? AND item_id=?",
    args: [userId, data, itemId],
  });
}

/**
 * A refeição do diário que corresponde a um bloco do plano.
 *
 * Casa pelo nome normalizado, e cria quando não existe — o que torna a
 * operação idempotente da segunda vez em diante. Sem isso, o que "Comi" lança
 * cairia em "avulsas" e o diário deixaria de espelhar o plano justamente para
 * quem segue um.
 */
async function refeicaoDoBloco(db: Client, userId: number, bloco: PlanBlock): Promise<number> {
  const rs = await db.execute({
    sql: "SELECT id, nome FROM meals WHERE user_id=? ORDER BY ordem",
    args: [userId],
  });
  const alvo = normalizar(bloco.nome);
  const achada = rs.rows.find((r) => normalizar(r.nome as string) === alvo);
  if (achada) return achada.id as number;

  const proxima = rs.rows.length;
  const novo = await db.execute({
    sql: "INSERT INTO meals (user_id, nome, horario, ordem) VALUES (?, ?, ?, ?)",
    args: [userId, bloco.nome, bloco.hora_inicio, proxima],
  });
  return Number(novo.lastInsertRowid);
}

/**
 * Marca (ou desmarca) um bloco no dia, e lança no diário o que ele contém.
 *
 * `UNIQUE (user_id, data, block_id)` garante um registro por bloco por dia; o
 * upsert atualiza em vez de acumular duplicatas.
 *
 * O lançamento é o que faz o plano encontrar o balanço energético: até aqui
 * marcar as quatro refeições do dia deixava o consumo em zero, porque o
 * consumo só olha `food_entries`. Só entra o item que resolve para um alimento
 * de verdade (ver `itensResolvidos`) — o resto o app não sabe contar, e não
 * inventa.
 *
 * `plan_block_id` é o que permite desmarcar sem tocar no que você digitou à
 * mão: apagar por `(data, bloco)` é preciso, apagar por "parece com o plano"
 * seria adivinhação.
 */
export async function marcarBloco(
  db: Client,
  userId: number,
  planId: number,
  data: string,
  blockId: number,
  feito: boolean,
  swapId: number | null = null,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO plan_checks (user_id, plan_id, data, block_id, feito, swap_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (user_id, data, block_id)
          DO UPDATE SET feito=excluded.feito, swap_id=excluded.swap_id`,
    args: [userId, planId, data, blockId, feito ? 1 : 0, swapId, new Date().toISOString()],
  });

  // Sempre limpa antes: é o que faz marcar duas vezes não duplicar, e é o
  // caminho inteiro do desmarcar.
  await db.execute({
    sql: "DELETE FROM food_entries WHERE user_id=? AND data=? AND plan_block_id=?",
    args: [userId, data, blockId],
  });
  if (!feito) return;

  const rsBloco = await db.execute({
    sql: "SELECT * FROM plan_blocks WHERE id=?",
    args: [blockId],
  });
  if (!rsBloco.rows.length) return;
  const bloco = mapBlock(rsBloco.rows[0]);
  // Água não tem item para lançar, e suplemento não é caloria.
  if (bloco.tipo !== "refeicao") return;

  const rsItens = await db.execute({
    sql: "SELECT * FROM plan_items WHERE block_id=? ORDER BY ordem",
    args: [blockId],
  });
  const itens = rsItens.rows.map(mapItem);
  const { lancaveis } = itensResolvidos(itens, await listTrocasDoDia(db, userId, data));
  if (lancaveis.length === 0) return;

  const mealId = await refeicaoDoBloco(db, userId, bloco);
  const created_at = new Date().toISOString();
  await db.batch(
    lancaveis.map((l) => ({
      sql: `INSERT INTO food_entries
              (user_id, data, meal_id, food_id, qty_g, measure_id, measure_count,
               label, plan_block_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        userId, data, mealId, l.food_id, l.qty_g, l.measure_id, l.medidas,
        l.label, blockId, created_at,
      ] as (number | string | null)[],
    })),
    "write",
  );
}

/** Água creditada a cada bloco de período no dia. */
export async function aguaPorBloco(
  db: Client,
  userId: number,
  data: string,
): Promise<Map<number, number>> {
  const rs = await db.execute({
    sql: `SELECT block_id, SUM(ml) AS ml FROM water_log
          WHERE user_id=? AND data=? AND block_id IS NOT NULL
          GROUP BY block_id`,
    args: [userId, data],
  });
  return new Map(rs.rows.map((r) => [r.block_id as number, r.ml as number]));
}

export async function addAguaNoBloco(
  db: Client,
  userId: number,
  data: string,
  ml: number,
  blockId: number | null,
): Promise<void> {
  await db.execute({
    sql: "INSERT INTO water_log (user_id, data, ml, block_id, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [userId, data, ml, blockId, new Date().toISOString()],
  });
}
