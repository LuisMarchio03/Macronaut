import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { TRATADO_NA_TELA } from "../lib/query-client";
import {
  addAguaNoBloco,
  aguaPorBloco,
  ativarPlano,
  deletarPlano,
  getPlanoAtivo,
  importarPlano,
  listBlocos,
  listChecksDoDia,
  listItensPorBloco,
  listMacros,
  listPlanos,
  listSubstituicoes,
  marcarBloco,
} from "../repositories/plano";
import type { DietPlan, RascunhoPlano } from "../domain/plano-types";

const CHAVE = {
  ativo: ["plano", "ativo"] as const,
  lista: ["plano", "lista"] as const,
  blocos: (id?: number) => ["plano", "blocos", id] as const,
  itens: (id?: number) => ["plano", "itens", id] as const,
  macros: (id?: number) => ["plano", "macros", id] as const,
  swaps: (id?: number) => ["plano", "swaps", id] as const,
  checks: (data: string) => ["plano", "checks", data] as const,
  agua: (data: string) => ["plano", "agua-bloco", data] as const,
};

export function usePlanoAtivo() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: CHAVE.ativo, queryFn: () => getPlanoAtivo(db, userId) });
}

export function usePlanos() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: CHAVE.lista, queryFn: () => listPlanos(db, userId) });
}

export function useBlocos(planId: number | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: CHAVE.blocos(planId),
    queryFn: () => listBlocos(db, planId!),
    enabled: planId != null,
  });
}

export function useItensDoPlano(planId: number | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: CHAVE.itens(planId),
    queryFn: () => listItensPorBloco(db, planId!),
    enabled: planId != null,
  });
}

export function useMacrosDoPlano(planId: number | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: CHAVE.macros(planId),
    queryFn: () => listMacros(db, planId!),
    enabled: planId != null,
  });
}

export function useSubstituicoes(planId: number | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: CHAVE.swaps(planId),
    queryFn: () => listSubstituicoes(db, planId!),
    enabled: planId != null,
  });
}

export function useChecksDoDia(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.checks(data),
    queryFn: () => listChecksDoDia(db, userId, data),
  });
}

export function useAguaPorBloco(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.agua(data),
    queryFn: () => aguaPorBloco(db, userId, data),
  });
}

export function useImportarPlano() {
  const db = useDb();
  const userId = useUserId();
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
    }) => importarPlano(db, userId, rascunho, origem),
    // Invalida a raiz "plano": o plano novo troca blocos, itens, macros e
    // trocas de uma vez, e listar cada chave aqui seria mais uma coisa para
    // esquecer de atualizar quando surgir a próxima.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plano"] }),
  });
}

export function useAtivarPlano() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: number) => ativarPlano(db, userId, planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plano"] }),
  });
}

export function useDeletarPlano() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: number) => deletarPlano(db, userId, planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plano"] }),
  });
}

export function useMarcarBloco(data: string) {
  const db = useDb();
  const userId = useUserId();
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
    }) => marcarBloco(db, userId, planId, data, blockId, feito, swapId),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE.checks(data) }),
  });
}

export function useAddAgua(data: string) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ml, blockId }: { ml: number; blockId: number | null }) =>
      addAguaNoBloco(db, userId, data, ml, blockId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE.agua(data) });
      // O total do dia vive noutra chave e é o que a tela de nutrição mostra.
      qc.invalidateQueries({ queryKey: ["water", data] });
    },
  });
}
