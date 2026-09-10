import { estimativaKcal } from "./treino.js";

/**
 * CALISTENIA — a série que acontece fora da sessão.
 *
 * Flexões às 10h, agachamentos antes do banho, uma prancha entre uma reunião e
 * outra. Não é sessão (não tem começo, meio e fim) nem cardio (não tem duração
 * contínua), e é o modo de treino que o app não sabia registrar.
 *
 * Puro: recebe as séries e o peso corporal, devolve números. Nada aqui conhece
 * React, banco ou relógio — a data de hoje entra por argumento, porque uma
 * função que lê o relógio não se testa.
 */

/** Quanto tempo uma repetição leva. Estimativa, e a tela a rotula como tal. */
export const SEGUNDOS_POR_REP = 3;
/** "Calisthenics, vigorous effort" do Compendium of Physical Activities. */
export const MET_PADRAO = 8;
/** Exercício sem fração medida: metade do corpo. Conservador de propósito. */
export const FRACAO_PADRAO = 0.5;

const DIA_MS = 86_400_000;

/** Constrói a data no fuso local. Duplicado de `consistencia.ts` pela mesma
 *  razão que lá: `domain/` não deve receber `Date` já construída em toda
 *  chamada, e a alternativa seria importar de `lib/`. */
function local(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Medida = "reps" | "segundos";

export interface SerieAvulsa {
  id: number;
  data: string;
  /** A hora em que aconteceu. É dado: responde "quando eu faço isso?". */
  created_at: string;
  exercise_id: number;
  nome: string;
  grupo: string | null;
  reps: number | null;
  segundos: number | null;
  peso_extra_kg: number | null;
  fracao_corporal: number | null;
  met: number | null;
}

export interface TotaisDoDia {
  data: string;
  reps: number;
  segundos: number;
  volume_kg: number;
  kcal: number;
  nSeries: number;
}

export interface TotalPorExercicio {
  exercise_id: number;
  nome: string;
  medida: Medida;
  /** Reps somadas, ou segundos somados — conforme `medida`. */
  quantidade: number;
  nSeries: number;
  volume_kg: number;
  kcal: number;
  /** A maior série única. É o "1RM" da calistenia. */
  recorde: number;
}

export function medidaDa(s: SerieAvulsa): Medida {
  return s.segundos !== null ? "segundos" : "reps";
}

export function quantidadeDa(s: SerieAvulsa): number {
  return s.segundos ?? s.reps ?? 0;
}

/**
 * Carga movida: a fração do corpo que o movimento levanta, mais o que estiver
 * pendurado nele, vezes as repetições.
 *
 * Isometria devolve zero: não há repetição, e inventar uma para gerar volume
 * seria devolver um número que ninguém pode conferir. Prancha conta em
 * segundos e em caloria, que é o que ela de fato produz.
 */
export function volumeEquivalente(s: SerieAvulsa, pesoCorporalKg: number): number {
  if (s.reps === null) return 0;
  const carga = (s.fracao_corporal ?? FRACAO_PADRAO) * pesoCorporalKg + (s.peso_extra_kg ?? 0);
  return carga * s.reps;
}

export function segundosDeEsforco(s: SerieAvulsa): number {
  return s.segundos ?? (s.reps ?? 0) * SEGUNDOS_POR_REP;
}

/** A mesma conta do cardio da sessão, para os dois darem o mesmo número no
 *  balanço energético. Sem peso no perfil dá zero — um número feito de zero
 *  seria pior do que a ausência dele. */
export function kcalDaSerie(s: SerieAvulsa, pesoCorporalKg: number): number {
  return estimativaKcal(s.met ?? MET_PADRAO, pesoCorporalKg, segundosDeEsforco(s) / 60);
}

export function totaisPorDia(
  series: SerieAvulsa[],
  pesoCorporalKg: number,
): Map<string, TotaisDoDia> {
  const m = new Map<string, TotaisDoDia>();
  for (const s of series) {
    const atual = m.get(s.data) ?? {
      data: s.data, reps: 0, segundos: 0, volume_kg: 0, kcal: 0, nSeries: 0,
    };
    atual.reps += s.reps ?? 0;
    atual.segundos += s.segundos ?? 0;
    atual.volume_kg += volumeEquivalente(s, pesoCorporalKg);
    atual.kcal += kcalDaSerie(s, pesoCorporalKg);
    atual.nSeries += 1;
    m.set(s.data, atual);
  }
  return m;
}

/**
 * Do que mais moveu para o que menos.
 *
 * É a ordem em que "o que eu ando fazendo?" quer ser respondida — e o volume
 * manda antes da contagem porque 100 polichinelos não são 100 barras fixas.
 */
export function totaisPorExercicio(
  series: SerieAvulsa[],
  pesoCorporalKg: number,
): TotalPorExercicio[] {
  const m = new Map<number, TotalPorExercicio>();
  for (const s of series) {
    const atual = m.get(s.exercise_id) ?? {
      exercise_id: s.exercise_id, nome: s.nome, medida: medidaDa(s),
      quantidade: 0, nSeries: 0, volume_kg: 0, kcal: 0, recorde: 0,
    };
    const q = quantidadeDa(s);
    atual.quantidade += q;
    atual.nSeries += 1;
    atual.volume_kg += volumeEquivalente(s, pesoCorporalKg);
    atual.kcal += kcalDaSerie(s, pesoCorporalKg);
    atual.recorde = Math.max(atual.recorde, q);
    m.set(s.exercise_id, atual);
  }
  return [...m.values()].sort(
    (a, b) => b.volume_kg - a.volume_kg || b.quantidade - a.quantidade,
  );
}

export function kcalPorDia(series: SerieAvulsa[], pesoCorporalKg: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of series) {
    m.set(s.data, (m.get(s.data) ?? 0) + kcalDaSerie(s, pesoCorporalKg));
  }
  return m;
}

export function recordeDeSerie(series: SerieAvulsa[], exerciseId: number): number | null {
  const doExercicio = series.filter((s) => s.exercise_id === exerciseId).map(quantidadeDa);
  return doExercicio.length === 0 ? null : Math.max(...doExercicio);
}

/**
 * Dias seguidos com registro, contando para trás.
 *
 * Começa em `hoje`; se hoje ainda está vazio, começa em ontem — às 8h da manhã
 * você ainda não fez nada, e zerar a sequência de 12 dias nesse momento é
 * punir o usuário pelo relógio, não medir o hábito dele.
 */
export function sequenciaDeDias(datas: string[], hoje: string): number {
  const comRegistro = new Set(datas);
  if (comRegistro.size === 0) return 0;

  let cursor = comRegistro.has(hoje)
    ? local(hoje)
    : new Date(local(hoje).getTime() - DIA_MS);

  let n = 0;
  while (comRegistro.has(iso(cursor))) {
    n += 1;
    cursor = new Date(cursor.getTime() - DIA_MS);
  }
  return n;
}

/** Variação percentual entre dois períodos. `null` quando a base é zero:
 *  "+∞%" não é uma tendência, é uma divisão por zero na tela. */
export function tendencia(atual: number, base: number): number | null {
  if (base === 0) return null;
  return ((atual - base) / base) * 100;
}
