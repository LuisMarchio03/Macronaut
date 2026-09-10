import { horaParaMinutos } from "../lib/date.js";
import type {
  LancamentoDoPlano,
  PlanBlock,
  PlanCheck,
  PlanItem,
  PlanSwap,
  Troca,
} from "./plano-types.js";

/**
 * Estado de um bloco no dia que está sendo visto.
 *
 * - `feito`      já marcado
 * - `agora`      a janela de horário contém o momento atual
 * - `proximo`    ainda vai acontecer
 * - `atrasado`   a janela passou e não foi marcado
 * - `pendente`   sem horário (ancorado a um evento), ainda não marcado
 */
export type EstadoBloco = "feito" | "agora" | "proximo" | "atrasado" | "pendente";

/** Folga depois do fim da janela antes de chamar o bloco de atrasado. */
const TOLERANCIA_MIN = 30;

/** Sem hora de fim, a janela dura isto a partir do início. */
const JANELA_PADRAO_MIN = 60;

export interface BlocoDoDia {
  bloco: PlanBlock;
  estado: EstadoBloco;
  check: PlanCheck | null;
}

/**
 * Combina os blocos do plano com o que já foi marcado no dia.
 *
 * `minutosAgora` é `null` quando se está olhando outro dia que não hoje: aí
 * nenhum bloco é "agora" nem "atrasado", porque "agora" não significa nada
 * num dia que já passou ou que ainda não chegou.
 */
export function montarDia(
  blocos: PlanBlock[],
  checks: PlanCheck[],
  minutosAgora: number | null,
): BlocoDoDia[] {
  const porBloco = new Map(checks.map((c) => [c.block_id, c]));

  return blocos.map((bloco) => {
    const check = porBloco.get(bloco.id) ?? null;
    if (check?.feito) return { bloco, estado: "feito" as const, check };

    const inicio = horaParaMinutos(bloco.hora_inicio);
    if (inicio === null || minutosAgora === null) {
      return { bloco, estado: "pendente" as const, check };
    }

    const fim = horaParaMinutos(bloco.hora_fim) ?? inicio + JANELA_PADRAO_MIN;

    if (minutosAgora < inicio) return { bloco, estado: "proximo" as const, check };
    if (minutosAgora <= fim) return { bloco, estado: "agora" as const, check };
    if (minutosAgora <= fim + TOLERANCIA_MIN) return { bloco, estado: "agora" as const, check };
    return { bloco, estado: "atrasado" as const, check };
  });
}

/**
 * O bloco que a tela deve destacar.
 *
 * Prioridade: o que está acontecendo agora; senão o próximo que vem; senão o
 * mais atrasado. Um dia inteiro cumprido não destaca nada — não há próxima
 * ação a sugerir.
 *
 * Entre vários blocos "agora", vence o que começou por último. A tolerância de
 * 30 minutos mantém como "agora" um bloco cuja janela acabou de fechar, e sem
 * esse desempate ele roubaria o destaque do bloco que acabou de abrir — às
 * 12h30 o app apontaria para o período de água das 8h em vez do almoço.
 */
export function blocoEmFoco(dia: BlocoDoDia[]): BlocoDoDia | null {
  const agora = dia.filter((b) => b.estado === "agora");
  if (agora.length > 0) {
    return agora.reduce((maisRecente, b) =>
      (horaParaMinutos(b.bloco.hora_inicio) ?? -1) >
      (horaParaMinutos(maisRecente.bloco.hora_inicio) ?? -1)
        ? b
        : maisRecente,
    );
  }
  return (
    dia.find((b) => b.estado === "proximo") ??
    dia.find((b) => b.estado === "atrasado") ??
    null
  );
}

export interface Aderencia {
  feitas: number;
  total: number;
  /** 0 a 100. `total` zero devolve 0, não NaN. */
  pct: number;
}

/** Aderência conta só refeições: é a métrica que o plano de fato cobra. */
export function aderenciaDoDia(dia: BlocoDoDia[]): Aderencia {
  const refeicoes = dia.filter((b) => b.bloco.tipo === "refeicao");
  const feitas = refeicoes.filter((b) => b.estado === "feito").length;
  const total = refeicoes.length;
  return { feitas, total, pct: total > 0 ? Math.round((feitas / total) * 100) : 0 };
}

/** Meta de água do dia: a soma dos períodos, ou o alvo global se não houver. */
export function metaDeAgua(blocos: PlanBlock[], alvoGlobal: number | null): number {
  const soma = blocos
    .filter((b) => b.tipo === "agua")
    .reduce((s, b) => s + (b.ml_alvo ?? 0), 0);
  return soma > 0 ? soma : (alvoGlobal ?? 0);
}

/**
 * Substituições que servem para um item, agrupadas por categoria.
 *
 * O casamento é por nome do bloco e categoria do item. Item sem categoria não
 * recebe sugestão: oferecer a troca errada é pior do que não oferecer.
 */
export function trocasPara(
  swaps: PlanSwap[],
  blockNome: string,
  categoria: string | null,
): PlanSwap[] {
  if (!categoria) return [];
  const alvo = normalizar(blockNome);
  return swaps.filter(
    (s) => normalizar(s.block_nome) === alvo && normalizar(s.categoria) === normalizar(categoria),
  );
}

/** Todas as trocas de um bloco, agrupadas por categoria e em ordem de caloria. */
export function trocasDoBloco(swaps: PlanSwap[], blockNome: string): Map<string, PlanSwap[]> {
  const alvo = normalizar(blockNome);
  const out = new Map<string, PlanSwap[]>();
  for (const s of swaps) {
    if (normalizar(s.block_nome) !== alvo) continue;
    const lista = out.get(s.categoria);
    if (lista) lista.push(s);
    else out.set(s.categoria, [s]);
  }
  for (const lista of out.values()) lista.sort((a, b) => a.kcal - b.kcal);
  return out;
}

/* ══════════════════════════════════════════════════════════════════
   TROCA, NOS DOIS ESCOPOS

   Uma troca é de uma LINHA (`item_id` preenchido) ou da REFEIÇÃO inteira
   (`item_id` nulo). A da linha ajusta o que o plano manda; a da refeição
   substitui o bloco por uma lista nova, de quantos alimentos você quiser e sem
   relação com o que o nutricionista escreveu.

   As duas convivem na mesma tabela e NÃO convivem no mesmo bloco no mesmo dia:
   gravar a primeira troca da refeição apaga as trocas de linha (ver
   `adicionarTrocaDaRefeicao`). Uma refeição está num modo ou no outro.
   ══════════════════════════════════════════════════════════════════ */

/** A troca vigente de um item, ou `null` se ele está como o plano manda. */
/**
 * As trocas de uma linha, na ordem em que foram escolhidas.
 *
 * Era `trocaDoItem`, no singular, porque a tabela tinha `UNIQUE (user_id,
 * data, item_id)`. Uma linha passou a caber N alimentos quando trocar a
 * refeição inteira por duas coisas deixou de exigir inventar uma troca para
 * cada uma das outras linhas.
 *
 * A dispensa fica de fora: mora na mesma tabela, mas não é uma troca.
 */
export function trocasDoItem(trocas: Troca[], itemId: number): Troca[] {
  return trocas.filter((t) => t.item_id === itemId && !t.dispensado);
}

/** A linha que você marcou como não comida. */
export function itemDispensado(trocas: Troca[], itemId: number): boolean {
  return trocas.some((t) => t.item_id === itemId && t.dispensado);
}

/**
 * Os alimentos que substituíram a REFEIÇÃO inteira, na ordem em que entraram.
 *
 * `item_id` nulo é o que diz o escopo: a troca não está no lugar de uma linha,
 * está no lugar do bloco. É o caso de quem comeu uma pizza no lugar de um
 * almoço de quatro linhas — a lista nova não tem por que ter o tamanho do que
 * o nutricionista escreveu.
 *
 * `trocasDoItem` e `itemDispensado` não precisam saber deste escopo: elas
 * comparam `item_id` com um número, e `null` nunca é igual a um número.
 */
export function trocasDaRefeicao(trocas: Troca[], blockId: number): Troca[] {
  return trocas.filter((t) => t.block_id === blockId && t.item_id === null && !t.dispensado);
}

/** A refeição foi substituída inteira? */
export function refeicaoSubstituida(trocas: Troca[], blockId: number): boolean {
  return trocasDaRefeicao(trocas, blockId).length > 0;
}

/**
 * "Tapioca · 2 col. sopa (30g) · 90 kcal" — o que a tela mostra sob o item.
 *
 * Porção e caloria são opcionais e somem quando não existem. Escrever "0 kcal"
 * para uma troca sem número mentiria duas vezes: na tela, e para quem lesse
 * aquilo como um valor medido.
 */
export function descreverTroca(t: Troca): string {
  return [t.nome, t.porcao, t.kcal !== null ? `${Math.round(t.kcal)} kcal` : null]
    .filter((p): p is string => p !== null && p !== "")
    .join(" · ");
}

/**
 * O que "Comi" pode lançar no diário, e o que fica de fora.
 *
 * Um item só é lançável quando resolve para um alimento do catálogo com
 * quantidade positiva — `food_entries` exige `food_id` e tem
 * `CHECK (qty_g > 0)`.
 *
 * A regra que importa: **item trocado só pode ser lançado pela troca**. Cair
 * de volta no alimento original porque a troca não casou com o catálogo
 * registraria uma refeição que não aconteceu — e é justamente no dia em que
 * você trocou que o diário precisa estar certo.
 *
 * `naoContadas` é a mesma honestidade um nível acima: um alimento da lista da
 * refeição que o app não sabe contar aparece na tela, e não some do balanço
 * em silêncio.
 */
export function refeicaoResolvida(
  itens: PlanItem[],
  trocas: Troca[],
  blockId: number,
): {
  lancaveis: LancamentoDoPlano[];
  semAlimento: PlanItem[];
  dispensados: PlanItem[];
  naoContadas: Troca[];
} {
  // A refeição foi substituída inteira: as linhas do plano não são mais o que
  // se comeu, então nenhuma delas entra — nem como lançável, nem como aviso,
  // nem como dispensada. Quem responde pelo dia é a lista nova. É a regra do
  // item trocado, aplicada ao bloco.
  const daRefeicao = trocasDaRefeicao(trocas, blockId);
  if (daRefeicao.length > 0) {
    const lancaveis: LancamentoDoPlano[] = [];
    const naoContadas: Troca[] = [];
    for (const t of daRefeicao) {
      if (t.food_id === null || t.qty_g === null || t.qty_g <= 0) {
        naoContadas.push(t);
        continue;
      }
      lancaveis.push({
        item_id: null,
        food_id: t.food_id,
        qty_g: t.qty_g,
        measure_id: t.measure_id,
        medidas: t.medidas,
        label: t.nome,
      });
    }
    return { lancaveis, semAlimento: [], dispensados: [], naoContadas };
  }

  const lancaveis: LancamentoDoPlano[] = [];
  const semAlimento: PlanItem[] = [];
  const dispensados: PlanItem[] = [];

  for (const item of itens) {
    // Dispensada não é nem lançável nem "sem alimento": dizer "não entra no
    // balanço" sobre algo que você deliberadamente não comeu é ruído, não
    // aviso.
    if (itemDispensado(trocas, item.id)) {
      dispensados.push(item);
      continue;
    }

    const doItem = trocasDoItem(trocas, item.id);
    const fontes = doItem.length > 0
      ? doItem.map((t) => ({
          food_id: t.food_id, qty_g: t.qty_g,
          measure_id: t.measure_id, medidas: t.medidas, label: t.nome,
        }))
      : [{
          food_id: item.food_id, qty_g: item.qty_g,
          measure_id: null, medidas: null, label: item.texto,
        }];

    let algumaEntrou = false;
    for (const f of fontes) {
      const { food_id, qty_g } = f;
      if (food_id === null || qty_g === null || qty_g <= 0) continue;
      lancaveis.push({
        item_id: item.id, food_id, qty_g,
        measure_id: f.measure_id, medidas: f.medidas, label: f.label,
      });
      algumaEntrou = true;
    }
    // A linha só é "sem alimento" quando NADA dela pôde ser lançado — com duas
    // trocas e só uma casando com o catálogo, o aviso mentiria sobre a que
    // casou.
    if (!algumaEntrou) semAlimento.push(item);
  }

  return { lancaveis, semAlimento, dispensados, naoContadas: [] };
}

/**
 * A caloria que a refeição de HOJE vai ter, contra a que o plano previa.
 *
 * `incompleto` é o que vira o "+" de "380+ / ~400": uma troca de texto sem
 * caloria, ou uma linha intacta cujo alimento o app não conhece, não podem ser
 * somadas — e calar isso contaria zero, que é uma afirmação diferente de "não
 * sei".
 *
 * `kcalPorItem` traz a caloria das linhas INTACTAS: `PlanItem` guarda
 * `food_id` e `qty_g`, não kcal, e o domínio não consulta banco. Quem monta o
 * mapa é a tela, com os alimentos que ela já carregou.
 */
export function kcalDaRefeicao(
  itens: PlanItem[],
  trocas: Troca[],
  kcalPorItem: Map<number, number>,
  blockId: number,
): { total: number; incompleto: boolean } {
  // Substituída, a conta é só a da lista nova: as linhas do plano deixaram de
  // ser o que se vai comer, e somá-las contaria o almoço duas vezes.
  const daRefeicao = trocasDaRefeicao(trocas, blockId);
  if (daRefeicao.length > 0) {
    let total = 0;
    let incompleto = false;
    for (const t of daRefeicao) {
      if (t.kcal === null) incompleto = true;
      else total += t.kcal;
    }
    return { total: Math.round(total), incompleto };
  }

  let total = 0;
  let incompleto = false;

  for (const item of itens) {
    if (itemDispensado(trocas, item.id)) continue;

    const doItem = trocasDoItem(trocas, item.id);
    if (doItem.length > 0) {
      for (const t of doItem) {
        if (t.kcal === null) incompleto = true;
        else total += t.kcal;
      }
      continue;
    }

    const doPlano = kcalPorItem.get(item.id);
    if (doPlano === undefined) incompleto = true;
    else total += doPlano;
  }

  return { total: Math.round(total), incompleto };
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
