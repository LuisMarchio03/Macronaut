import { normalizar } from "./texto";
import type { ProgressoPonto, TipoSerie } from "./types";

export function estimativaKcal(met: number, peso_kg: number, duracao_min: number): number {
  return met * peso_kg * (duracao_min / 60);
}

export function e1RM(peso_kg: number, reps: number): number {
  return peso_kg * (1 + reps / 30);
}

export function volumeSet(peso_kg: number, reps: number): number {
  return peso_kg * reps;
}

export function serieDeProgressao(
  sets: { data: string; peso_kg: number; reps: number }[],
): ProgressoPonto[] {
  const porData = new Map<string, { peso_kg: number; reps: number }[]>();
  for (const s of sets) {
    const arr = porData.get(s.data) ?? [];
    arr.push({ peso_kg: s.peso_kg, reps: s.reps });
    porData.set(s.data, arr);
  }
  const pontos: ProgressoPonto[] = [];
  for (const [data, ss] of porData) {
    pontos.push({
      data,
      topPeso: Math.max(...ss.map((s) => s.peso_kg)),
      e1RM: Math.round(Math.max(...ss.map((s) => e1RM(s.peso_kg, s.reps)))),
      volume: ss.reduce((acc, s) => acc + volumeSet(s.peso_kg, s.reps), 0),
    });
  }
  return pontos.sort((a, b) => a.data.localeCompare(b.data));
}

/** Série efetiva = tudo que não é aquecimento. Drop e falha contam. */
export function seriesEfetivas<T extends { tipo: TipoSerie }>(sets: T[]): T[] {
  return sets.filter((s) => s.tipo !== "aquecimento");
}

/** RIR 4 é "4 ou mais" por spec — mostra "4+" em vez do número cru. */
export function rotuloRir(r: number): string {
  return r === 4 ? "4+" : String(r);
}

/**
 * Resume um conjunto de séries para leitura rápida (ex.: painel "anterior").
 * Reps e peso são resumidos de forma independente: uniformes viram "3×10" /
 * "@ 40 kg"; variando, cada série aparece — "10,10,12" / "@ 40/40/25 kg".
 * Drop set é o caso comum de peso variando (cada série cai de carga).
 * Não é chamada com lista vazia: `ultimaVezExercicio` filtra aquecimento nas
 * duas queries, então sessão só-aquecimento nunca chega aqui como histórico.
 */
export function resumirSets(sets: { reps: number; peso_kg: number }[]): string {
  const reps = sets.map((s) => s.reps);
  const pesos = sets.map((s) => s.peso_kg);
  const mesmasReps = reps.every((r) => r === reps[0]);
  const mesmoPeso = pesos.every((p) => p === pesos[0]);
  const parteReps = mesmasReps ? `${sets.length}×${reps[0]}` : reps.join(",");
  const partePeso = mesmoPeso ? `${pesos[0]}` : pesos.join("/");
  return `${parteReps} @ ${partePeso} kg`;
}

/**
 * Duração estimada da sessão, derivada de `created_at` das séries.
 * Mede da primeira à última série — ignora o tempo da primeira série e o
 * aquecimento anterior a ela. Sessão de série única dá 0.
 */
export function duracaoSessaoMin(sets: { created_at: string }[]): number {
  if (sets.length === 0) return 0;
  const ts = sets.map((s) => Date.parse(s.created_at));
  return Math.round((Math.max(...ts) - Math.min(...ts)) / 60_000);
}

/* ══════════════════════════════════════════════════════════════════
   A FICHA DO EXERCÍCIO

   Três campos de texto livre viram três listas. Puro de propósito: é
   formatação de conteúdo, e a tela não deve saber que "secundários"
   é uma string separada por vírgula no banco.
   ══════════════════════════════════════════════════════════════════ */

/** "Peito, Tríceps" → ["Peito", "Tríceps"]. Vazio e nulo dão lista vazia. */
export function listaPorVirgula(texto: string | null | undefined): string[] {
  if (!texto) return [];
  return texto
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** As instruções guardam um passo por linha. Linha em branco não é passo. */
export function passosDaExecucao(instrucoes: string | null | undefined): string[] {
  if (!instrucoes) return [];
  return instrucoes
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Onde ver a execução do exercício.
 *
 * O app não hospeda vídeo nem foto: manda para onde a resposta já existe e
 * está atualizada. A busca leva o termo pronto — "execução correta" no Google,
 * "como fazer" no YouTube — porque o nome sozinho ("Rosca scott") devolve
 * loja de equipamento antes de qualquer demonstração.
 */
export function urlDeExecucao(nome: string, onde: "google" | "youtube"): string {
  return onde === "google"
    ? `https://www.google.com/search?q=${encodeURIComponent(`${nome} execução correta`)}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(`como fazer ${nome}`)}`;
}

/**
 * O exercício responde por este termo de busca?
 *
 * Casa nome E apelidos, sem acento e sem caixa. Ninguém procura "Supino reto
 * com barra" na academia — procura "supino", ou "bench". Sem os apelidos, um
 * catálogo grande vira um catálogo em que você não acha nada e cadastra de
 * novo o que já existe.
 */
export function casaBusca(
  nome: string,
  aliases: string | null | undefined,
  termo: string,
): boolean {
  const t = normalizar(termo);
  if (t === "") return true;
  if (normalizar(nome).includes(t)) return true;
  return listaPorVirgula(aliases).some((a) => normalizar(a).includes(t));
}
