import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";
import { TRATADO_NA_TELA } from "../lib/query-client";
import type { TrocaEntrada } from "../repositories/plano";
import type { DietPlan, RascunhoPlano } from "../domain/plano-types";

const CHAVE = {
  ativo: ["plano", "ativo"] as const,
  lista: ["plano", "lista"] as const,
  blocos: (id?: number) => ["plano", "blocos", id] as const,
  itens: (id?: number) => ["plano", "itens", id] as const,
  macros: (id?: number) => ["plano", "macros", id] as const,
  swaps: (id?: number) => ["plano", "swaps", id] as const,
  checks: (data: string) => ["plano", "checks", data] as const,
  trocas: (data: string) => ["plano", "trocas", data] as const,
  agua: (data: string) => ["plano", "agua-bloco", data] as const,
};

export function usePlanoAtivo() {
  const api = useApi();
  return useQuery({ queryKey: CHAVE.ativo, queryFn: () => api["plano"].getPlanoAtivo() });
}

export function usePlanos() {
  const api = useApi();
  return useQuery({ queryKey: CHAVE.lista, queryFn: () => api["plano"].listPlanos() });
}

export function useBlocos(planId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.blocos(planId),
    queryFn: () => api["plano"].listBlocos(planId!),
    enabled: planId != null,
  });
}

export function useItensDoPlano(planId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.itens(planId),
    queryFn: () => api["plano"].listItensPorBloco(planId!),
    enabled: planId != null,
  });
}

export function useMacrosDoPlano(planId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.macros(planId),
    queryFn: () => api["plano"].listMacros(planId!),
    enabled: planId != null,
  });
}

export function useSubstituicoes(planId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.swaps(planId),
    queryFn: () => api["plano"].listSubstituicoes(planId!),
    enabled: planId != null,
  });
}

export function useChecksDoDia(data: string) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.checks(data),
    queryFn: () => api["plano"].listChecksDoDia(data),
  });
}

/** As trocas de item do dia — a folha e o card do bloco leem daqui. */
export function useTrocasDoDia(data: string) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.trocas(data),
    queryFn: () => api["plano"].listTrocasDoDia(data),
  });
}

export function useAguaPorBloco(data: string) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.agua(data),
    queryFn: () => api["plano"].aguaPorBloco(data),
  });
}

export function useImportarPlano() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    // A tela de import mostra a falha ao lado do botão, com detalhe técnico.
    meta: TRATADO_NA_TELA,
    mutationFn: ({
      rascunho,
      origem,
    }: {
      rascunho: RascunhoPlano;
      origem: DietPlan["origem"];
    }) => api["plano"].importarPlano(rascunho, origem),
    // Invalida a raiz "plano": o plano novo troca blocos, itens, macros e
    // trocas de uma vez, e listar cada chave aqui seria mais uma coisa para
    // esquecer de atualizar quando surgir a próxima.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plano"] }),
  });
}

export function useAtivarPlano() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: number) => api["plano"].ativarPlano(planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plano"] }),
  });
}

export function useDeletarPlano() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: number) => api["plano"].deletarPlano(planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plano"] }),
  });
}

export function useMarcarBloco(data: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      blockId,
      feito,
      swapId = null,
    }: {
      planId: number;
      blockId: number;
      feito: boolean;
      swapId?: number | null;
    }) => api["plano"].marcarBloco(planId, data, blockId, feito, swapId),
    // Marcar deixou de ser só um check: lança (e desmarcar apaga) no diário do
    // dia, e pode criar a refeição correspondente. Invalidar só os checks
    // deixaria o balanço energético da tela desatualizado até um F5.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE.checks(data) });
      qc.invalidateQueries({ queryKey: ["entries", data] });
      qc.invalidateQueries({ queryKey: ["meals"] });
    },
  });
}

/**
 * Grava, corrige ou desfaz a troca de um item.
 *
 * `entrada === null` desfaz. As duas invalidam o diário junto: o que o bloco
 * lança depende da troca vigente, e um bloco já marcado tem que refletir a
 * troca nova.
 */
/**
 * Toda escrita de troca mexe nas mesmas três chaves: a troca em si, o check do
 * bloco (marcar "Comi" relança o diário a partir das trocas) e as entries do
 * dia.
 *
 * Eram todas um hook só, que decidia entre gravar e apagar por um `if` na
 * forma do argumento. Com quatro escritas diferentes aquilo viraria um `if`
 * de quatro braços; a parte comum é a invalidação, e é só ela que fica junta.
 */
function useEscritaDeTroca<T>(data: string, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE.trocas(data) });
      qc.invalidateQueries({ queryKey: CHAVE.checks(data) });
      qc.invalidateQueries({ queryKey: ["entries", data] });
    },
  });
}

/** Acrescenta um alimento à linha, sem tirar os que já estavam. */
export function useAdicionarTroca(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (e: TrocaEntrada) => api["plano"].adicionarTroca(e));
}

/** Substitui tudo que havia na linha — é o que a aba "Do plano" faz. */
export function useSalvarTroca(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (e: TrocaEntrada) => api["plano"].salvarTroca(e));
}

/** Tira um alimento só, deixando os outros da linha. */
export function useRemoverUmaTroca(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (trocaId: number) => api["plano"].removerUmaTroca(trocaId));
}

/** "Não comi esta linha." */
export function useDispensarItem(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (v: { blockId: number; itemId: number }) =>
    api["plano"].dispensarItem(data, v.blockId, v.itemId),
  );
}

/** Devolve a linha ao plano: apaga trocas e dispensa. */
export function useLimparTrocasDoItem(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (itemId: number) => api["plano"].removerTroca(data, itemId));
}

export function useAddAgua(data: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ml, blockId }: { ml: number; blockId: number | null }) =>
      api["plano"].addAguaNoBloco(data, ml, blockId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE.agua(data) });
      // O total do dia vive noutra chave e é o que a tela de nutrição mostra.
      qc.invalidateQueries({ queryKey: ["water", data] });
    },
  });
}
