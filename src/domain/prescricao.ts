import type { TipoSerie } from "./types";
import { arredondarCarga, sessaoPrescrita, tmVigente, type Parte, type Semana } from "./531";

/**
 * Como a carga de hoje é decidida.
 *
 * Puro de propósito: é a conta que manda a pessoa levantar um peso, e conta
 * errada aqui custa uma sessão ou um ombro. Nada aqui conhece React nem banco.
 */

export type TipoPrescricao = "dupla" | "fixa" | "531";

export type Prescricao =
  | {
      tipo: "dupla";
      series: number;
      reps_min: number;
      reps_max: number;
      peso_inicial_kg: number;
      incremento_kg: number;
    }
  | { tipo: "fixa"; series: number; reps: number; peso_kg: number }
  | { tipo: "531"; tm_kg: number; parte: Parte; incremento_kg: number };

/** Uma sessão passada do exercício. Só séries efetivas — aquecimento fora. */
export interface SessaoAnterior {
  data: string;
  sets: { reps: number; peso_kg: number }[];
}

export interface SeriePlanejada {
  /** Posição da série DENTRO do exercício, 1..n. A ordem na sessão inteira é
   *  atribuída por quem materializa — só o repository sabe o que mais tem lá. */
  ordem: number;
  peso_kg: number;
  /** O número a bater. Na dupla progressão é sempre o topo da faixa: é ele que
   *  faz a carga subir, então é ele que aparece na tela. */
  reps_alvo: number;
  /** O piso da faixa, quando há faixa. Terminar dentro dela não é falhar. */
  reps_min: number | null;
  tipo: TipoSerie;
  amrap: boolean;
  /** Percentual do Training Max. Só o 5/3/1 tem. */
  pct: number | null;
}

/**
 * A carga de trabalho de uma sessão passada: o peso mais pesado e as
 * repetições feitas nele.
 *
 * As séries leves do fim (drop set) não são a carga de trabalho — considerá-las
 * faria a progressão achar que o exercício regrediu toda vez que houvesse drop.
 */
function cargaDeTrabalho(s: SessaoAnterior | undefined): { peso: number; reps: number[] } | null {
  if (!s || s.sets.length === 0) return null;
  const peso = Math.max(...s.sets.map((x) => x.peso_kg));
  return { peso, reps: s.sets.filter((x) => x.peso_kg === peso).map((x) => x.reps) };
}

function cargaDupla(
  p: Extract<Prescricao, { tipo: "dupla" }>,
  anteriores: SessaoAnterior[],
): number {
  const ultima = cargaDeTrabalho(anteriores[0]);
  if (!ultima) return p.peso_inicial_kg;

  // Todas as séries no topo da faixa: a carga é sua, sobe.
  if (ultima.reps.every((r) => r >= p.reps_max)) {
    return arredondarCarga(ultima.peso + p.incremento_kg, p.incremento_kg);
  }

  // Dentro da faixa: o trabalho de hoje é ganhar repetição, não peso.
  if (ultima.reps.every((r) => r >= p.reps_min)) return ultima.peso;

  // Falhou. Um dia ruim não derruba a carga; dois no MESMO peso, sim — senão a
  // progressão oscila em torno de um número em vez de subir.
  const anterior = cargaDeTrabalho(anteriores[1]);
  const reincidente =
    anterior !== null &&
    anterior.peso === ultima.peso &&
    anterior.reps.some((r) => r < p.reps_min);

  return reincidente ? arredondarCarga(ultima.peso * 0.9, p.incremento_kg) : ultima.peso;
}

function planejarDupla(
  p: Extract<Prescricao, { tipo: "dupla" }>,
  anteriores: SessaoAnterior[],
): SeriePlanejada[] {
  const peso_kg = cargaDupla(p, anteriores);
  return Array.from({ length: p.series }, (_, i) => ({
    ordem: i + 1,
    peso_kg,
    reps_alvo: p.reps_max,
    reps_min: p.reps_min,
    tipo: "valida" as const,
    amrap: false,
    pct: null,
  }));
}

function planejarFixa(p: Extract<Prescricao, { tipo: "fixa" }>): SeriePlanejada[] {
  return Array.from({ length: p.series }, (_, i) => ({
    ordem: i + 1,
    peso_kg: p.peso_kg,
    reps_alvo: p.reps,
    reps_min: null,
    tipo: "valida" as const,
    amrap: false,
    pct: null,
  }));
}

/**
 * Onde o exercício está no 5/3/1, derivado de quantas sessões dele já foram
 * feitas.
 *
 * Numa rotina semanal cada exercício anda no seu próprio passo — não faz
 * sentido segurar a semana do supino esperando o agachamento, como a regra
 * antiga (por programa, com os quatro levantamentos travados juntos) fazia.
 */
export function posicao531(sessoesFeitas: number): { ciclo: number; semana: Semana } {
  return {
    ciclo: Math.floor(sessoesFeitas / 4) + 1,
    semana: ((sessoesFeitas % 4) + 1) as Semana,
  };
}

function planejar531(
  p: Extract<Prescricao, { tipo: "531" }>,
  anteriores: SessaoAnterior[],
): SeriePlanejada[] {
  const { ciclo, semana } = posicao531(anteriores.length);
  const tm = tmVigente(p.tm_kg, p.parte, ciclo - 1, p.incremento_kg);
  return sessaoPrescrita(tm, semana, p.incremento_kg).map((s, i) => ({
    ordem: i + 1,
    peso_kg: s.peso_kg,
    reps_alvo: s.reps,
    reps_min: null,
    tipo: s.tipo === "aquecimento" ? ("aquecimento" as const) : ("valida" as const),
    amrap: s.amrap,
    pct: s.pct,
  }));
}

/** As séries de hoje para UM exercício, dadas as sessões passadas dele —
 *  da mais recente para a mais antiga. */
export function planejar(p: Prescricao, anteriores: SessaoAnterior[]): SeriePlanejada[] {
  switch (p.tipo) {
    case "fixa":
      return planejarFixa(p);
    case "dupla":
      return planejarDupla(p, anteriores);
    case "531":
      return planejar531(p, anteriores);
  }
}

/* ══════════════════════════════════════════════════════════════════
   QUAL É O TREINO DE HOJE

   A rotina é semanal e indexada pelo dia (0 = domingo). Dia sem
   entrada é descanso — a ausência é o dado, não um registro de
   "descanso" que precisaria ser criado e mantido em sincronia.
   ══════════════════════════════════════════════════════════════════ */

export function treinoDoDia<T extends { dia_semana: number }>(
  dias: T[],
  diaSemana: number,
): T | null {
  return dias.find((d) => d.dia_semana === diaSemana) ?? null;
}

/**
 * O próximo dia de treino a partir de `diaSemana`, exclusive.
 *
 * Anda até sete casas: na sétima o alvo é o próprio `diaSemana`, o que dá a
 * resposta certa para quem treina uma vez por semana — o próximo é ele mesmo,
 * daqui a sete dias.
 */
export function proximoTreino<T extends { dia_semana: number }>(
  dias: T[],
  diaSemana: number,
): T | null {
  for (let i = 1; i <= 7; i++) {
    const alvo = (diaSemana + i) % 7;
    const d = dias.find((x) => x.dia_semana === alvo);
    if (d) return d;
  }
  return null;
}
