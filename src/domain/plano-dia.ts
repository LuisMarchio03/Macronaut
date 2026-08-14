import { horaParaMinutos } from "../lib/date";
import type { PlanBlock, PlanCheck, PlanSwap } from "./plano-types";

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

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
