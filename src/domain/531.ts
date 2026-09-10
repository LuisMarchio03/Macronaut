import { e1RM } from "./treino.js";

/**
 * A matemática do 5/3/1 (Jim Wendler).
 *
 * Pura de propósito: a conta que o método define é o valor inteiro do módulo
 * de treino, e conta errada aqui manda a pessoa levantar peso errado. Nada
 * aqui conhece React nem banco.
 */

export type Semana = 1 | 2 | 3 | 4;
export type Parte = "superior" | "inferior";

export interface SeriePrescrita {
  tipo: "aquecimento" | "trabalho";
  /** Percentual do Training Max. */
  pct: number;
  /** Repetições prescritas. Na AMRAP é o mínimo a bater. */
  reps: number;
  /** Última série das semanas 1 a 3: faça o máximo que conseguir. */
  amrap: boolean;
  peso_kg: number;
}

/**
 * Séries de trabalho por semana do ciclo.
 *
 * A semana 4 é deload e NÃO tem AMRAP: o deload existe para recuperar, e
 * transformá-lo em teste anula o propósito dele.
 */
const TRABALHO: Record<Semana, { pct: number; reps: number; amrap: boolean }[]> = {
  1: [
    { pct: 65, reps: 5, amrap: false },
    { pct: 75, reps: 5, amrap: false },
    { pct: 85, reps: 5, amrap: true },
  ],
  2: [
    { pct: 70, reps: 3, amrap: false },
    { pct: 80, reps: 3, amrap: false },
    { pct: 90, reps: 3, amrap: true },
  ],
  3: [
    { pct: 75, reps: 5, amrap: false },
    { pct: 85, reps: 3, amrap: false },
    { pct: 95, reps: 1, amrap: true },
  ],
  4: [
    { pct: 40, reps: 5, amrap: false },
    { pct: 50, reps: 5, amrap: false },
    { pct: 60, reps: 5, amrap: false },
  ],
};

const AQUECIMENTO = [
  { pct: 40, reps: 5 },
  { pct: 50, reps: 5 },
  { pct: 60, reps: 3 },
];

/** Quanto o Training Max sobe ao fim de um ciclo, por parte do corpo. */
const SUBIDA_POR_CICLO: Record<Parte, number> = {
  superior: 2.5,
  inferior: 5,
};

export const SEMANAS: Semana[] = [1, 2, 3, 4];

/** Nome da semana como o método a chama. */
export function nomeDaSemana(s: Semana): string {
  return s === 1 ? "5/5/5+" : s === 2 ? "3/3/3+" : s === 3 ? "5/3/1+" : "deload";
}

export function ehDeload(s: Semana): boolean {
  return s === 4;
}

/**
 * Arredonda para o múltiplo mais próximo do incremento de anilha.
 *
 * Empate desce: em dúvida entre duas cargas, a mais leve é a que não custa a
 * sessão. Incremento inválido devolve o valor intacto em vez de dividir por
 * zero.
 */
export function arredondarCarga(kg: number, incremento: number): number {
  if (!(incremento > 0)) return kg;
  const passos = kg / incremento;
  const baixo = Math.floor(passos);
  const resto = passos - baixo;
  const escolhido = resto > 0.5 ? baixo + 1 : baixo;
  // Duas casas evitam 47.500000000000004 vindo do ponto flutuante.
  return Math.round(escolhido * incremento * 100) / 100;
}

/**
 * Training Max a partir do 1RM: 90%.
 *
 * Aplicar os percentuais do método sobre o 1RM em vez do TM faz treinar ~11%
 * mais pesado do que o método pede — é o erro clássico de quem implementa
 * 5/3/1, e a razão de o valor guardado ser o TM.
 */
export function trainingMaxDe1RM(umRM: number, incremento: number): number {
  return arredondarCarga(umRM * 0.9, incremento);
}

/** O 1RM que corresponde a um TM, para mostrar de volta ao usuário. */
export function umRMDeTrainingMax(tm: number): number {
  return Math.round(tm / 0.9);
}

/**
 * As séries de uma sessão: aquecimento seguido do trabalho.
 *
 * O aquecimento é omitido no deload porque as próprias séries de trabalho da
 * semana 4 já são 40/50/60% — repetir seria fazer a mesma coisa duas vezes.
 */
export function sessaoPrescrita(
  tm: number,
  semana: Semana,
  incremento: number,
): SeriePrescrita[] {
  const carga = (pct: number) => arredondarCarga((tm * pct) / 100, incremento);

  const aquecimento: SeriePrescrita[] = ehDeload(semana)
    ? []
    : AQUECIMENTO.map((a) => ({
        tipo: "aquecimento" as const,
        pct: a.pct,
        reps: a.reps,
        amrap: false,
        peso_kg: carga(a.pct),
      }));

  const trabalho: SeriePrescrita[] = TRABALHO[semana].map((t) => ({
    tipo: "trabalho" as const,
    pct: t.pct,
    reps: t.reps,
    amrap: t.amrap,
    peso_kg: carga(t.pct),
  }));

  return [...aquecimento, ...trabalho];
}

/** Só as séries que contam como treino. */
export function seriesDeTrabalho(sessao: SeriePrescrita[]): SeriePrescrita[] {
  return sessao.filter((s) => s.tipo === "trabalho");
}

/** A série AMRAP da sessão, quando existe (o deload não tem). */
export function serieAmrap(sessao: SeriePrescrita[]): SeriePrescrita | null {
  return sessao.find((s) => s.amrap) ?? null;
}

/** O TM do próximo ciclo. Superior sobe 2,5 kg; inferior, 5 kg. */
export function proximoTM(tm: number, parte: Parte, incremento: number): number {
  return arredondarCarga(tm + SUBIDA_POR_CICLO[parte], incremento);
}

/** 1RM estimado a partir de uma série levada ao limite (Epley). */
export function e1RMDaSerie(peso_kg: number, reps: number): number {
  return Math.round(e1RM(peso_kg, reps));
}

/* ══════════════════════════════════════════════════════════════════
   RECORDES

   No 5/3/1 o recorde é de REPETIÇÕES NUM PESO, não de carga máxima.
   É o que a série AMRAP mede e o que o método usa como motivação.
   ══════════════════════════════════════════════════════════════════ */

export interface MarcaAmrap {
  peso_kg: number;
  reps: number;
}

/**
 * Quantas repetições você precisa bater naquele peso para fazer recorde.
 *
 * `null` quando nunca se treinou esse peso — não há recorde a bater, e
 * inventar um número seria mentir.
 */
export function recordeNoPeso(historico: MarcaAmrap[], peso_kg: number): number | null {
  const mesmas = historico.filter((m) => m.peso_kg === peso_kg);
  return mesmas.length > 0 ? Math.max(...mesmas.map((m) => m.reps)) : null;
}

export function ehRecorde(historico: MarcaAmrap[], peso_kg: number, reps: number): boolean {
  const atual = recordeNoPeso(historico, peso_kg);
  return atual === null ? false : reps > atual;
}

/* ══════════════════════════════════════════════════════════════════
   ESTADO DO PROGRAMA

   Derivado das sessões concluídas, nunca guardado. Apagar uma sessão
   ou registrar fora de ordem se corrige sozinho — um contador
   persistido ficaria mentindo para sempre.
   ══════════════════════════════════════════════════════════════════ */

export interface SessaoConcluida {
  lift_id: number;
  ciclo: number;
  semana: number;
}

export interface Posicao {
  ciclo: number;
  semana: Semana;
  /** O levantamento da vez, entre os `liftIds` na ordem dada. */
  lift_id: number | null;
}

/**
 * Onde o programa está: ciclo, semana e qual levantamento vem agora.
 *
 * Avança quando os quatro levantamentos da semana foram feitos; passada a
 * semana 4, começa um ciclo novo. Sem levantamentos configurados devolve o
 * início, com `lift_id` nulo — não há o que treinar.
 */
export function proximaSessao(liftIds: number[], feitas: SessaoConcluida[]): Posicao {
  if (liftIds.length === 0) return { ciclo: 1, semana: 1, lift_id: null };

  const feitasDe = (ciclo: number, semana: number) =>
    new Set(feitas.filter((f) => f.ciclo === ciclo && f.semana === semana).map((f) => f.lift_id));

  // Começa do começo e caminha até achar uma posição incompleta. O número de
  // ciclos é limitado pelo que já foi feito, então a busca sempre termina.
  const ultimoCiclo = feitas.reduce((max, f) => Math.max(max, f.ciclo), 1);

  for (let ciclo = 1; ciclo <= ultimoCiclo + 1; ciclo++) {
    for (const semana of SEMANAS) {
      const jaFeitos = feitasDe(ciclo, semana);
      const pendente = liftIds.find((id) => !jaFeitos.has(id));
      if (pendente !== undefined) return { ciclo, semana, lift_id: pendente };
    }
  }

  return { ciclo: ultimoCiclo + 1, semana: 1, lift_id: liftIds[0] };
}

/**
 * Quantos ciclos INTEIROS foram concluídos — é quantas vezes o TM já subiu.
 *
 * Um ciclo só conta como concluído quando todos os levantamentos passaram
 * pelas quatro semanas; ciclo pela metade não faz o TM subir.
 */
export function ciclosConcluidos(liftIds: number[], feitas: SessaoConcluida[]): number {
  if (liftIds.length === 0) return 0;
  let n = 0;
  for (let ciclo = 1; ; ciclo++) {
    const completo = SEMANAS.every((semana) => {
      const feitosNaSemana = new Set(
        feitas.filter((f) => f.ciclo === ciclo && f.semana === semana).map((f) => f.lift_id),
      );
      return liftIds.every((id) => feitosNaSemana.has(id));
    });
    if (!completo) return n;
    n = ciclo;
  }
}

/** O TM vigente de um levantamento, dado quantos ciclos já fecharam. */
export function tmVigente(
  tmInicial: number,
  parte: Parte,
  ciclosFechados: number,
  incremento: number,
): number {
  let tm = tmInicial;
  for (let i = 0; i < ciclosFechados; i++) tm = proximoTM(tm, parte, incremento);
  return tm;
}

/* ══════════════════════════════════════════════════════════════════
   SUGESTÃO DE LEVANTAMENTOS

   O catálogo tem "Agachamento livre" e também "Agachamento hack",
   "frontal" e "no Smith". Escolher o primeiro que contém a palavra
   sugere uma variação no lugar do levantamento principal do método.
   ══════════════════════════════════════════════════════════════════ */

export interface SugestaoLevantamento {
  /** Nomes aceitáveis, do mais específico ao mais genérico. */
  termos: string[];
  parte: Parte;
}

/** Os quatro levantamentos do 5/3/1, com as variações aceitáveis em ordem. */
export const LEVANTAMENTOS_SUGERIDOS: SugestaoLevantamento[] = [
  { termos: ["agachamento livre", "agachamento"], parte: "inferior" },
  { termos: ["supino reto com barra", "supino reto", "supino"], parte: "superior" },
  { termos: ["levantamento terra", "terra"], parte: "inferior" },
  {
    termos: ["desenvolvimento militar com barra", "desenvolvimento militar", "desenvolvimento"],
    parte: "superior",
  },
];

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Escolhe o exercício do catálogo que melhor corresponde à sugestão.
 *
 * Percorre os termos do mais específico ao mais genérico e, dentro de cada
 * termo, prefere o nome mais curto — uma variação sempre carrega palavras a
 * mais ("Agachamento **frontal**", "Supino **declinado** com barra").
 */
export function escolherSugestao<T extends { nome: string }>(
  catalogo: T[],
  sugestao: SugestaoLevantamento,
): T | null {
  for (const termo of sugestao.termos) {
    const alvo = semAcento(termo);
    const candidatos = catalogo.filter((e) => semAcento(e.nome).includes(alvo));
    if (candidatos.length === 0) continue;

    const exato = candidatos.find((e) => semAcento(e.nome) === alvo);
    if (exato) return exato;

    return candidatos.reduce((a, b) => (b.nome.length < a.nome.length ? b : a));
  }
  return null;
}
