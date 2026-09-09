import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";
import type { ExercicioRotinaInput, Rotina } from "../repositories/rotina";

/**
 * Primeiro módulo a falar por `/api/rpc` em vez de `/api/db`.
 *
 * A diferença que se vê aqui é o que sumiu: `db` e `userId`. O `user_id` passa
 * a vir do token, no servidor — este arquivo não tem mais como dizer de quem é
 * a rotina que está pedindo, nem por engano.
 */

const CHAVE = {
  raiz: ["rotina"] as const,
  ativa: ["rotina", "ativa"] as const,
  dias: (id?: number) => ["rotina", "dias", id] as const,
  exercicios: (dayId?: number) => ["rotina", "exercicios", dayId] as const,
  todos: (id?: number) => ["rotina", "todos", id] as const,
};

export function useRotinaAtiva() {
  const api = useApi();
  return useQuery({ queryKey: CHAVE.ativa, queryFn: () => api.rotina.getRotinaAtiva() });
}

export function useDiasDaRotina(rotina: Rotina | null | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.dias(rotina?.id),
    queryFn: () => api.rotina.listDias(rotina!.id),
    enabled: rotina != null,
  });
}

export function useExerciciosDoDia(dayId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.exercicios(dayId),
    queryFn: () => api.rotina.listExercicios(dayId!),
    enabled: dayId != null,
  });
}

export function useExerciciosDaRotina(rotina: Rotina | null | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: CHAVE.todos(rotina?.id),
    queryFn: () => api.rotina.listExerciciosDaRotina(rotina!.id),
    enabled: rotina != null,
  });
}

/**
 * Invalida a raiz de `rotina` e o plano do dia.
 *
 * Qualquer escrita na rotina pode mexer em dias, exercícios e no que o hub
 * mostra como treino de hoje — invalidar por partes deixaria alguma tela
 * mentindo, e a rotina muda raramente o bastante para o custo não importar.
 */
function useEscritaNaRotina<TVars, TDados>(fn: (v: TVars) => Promise<TDados>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE.raiz });
      qc.invalidateQueries({ queryKey: ["sessao", "plano-do-dia"] });
    },
  });
}

export function useCriarRotina() {
  const api = useApi();
  return useEscritaNaRotina((nome: string) => api.rotina.criarRotina(nome));
}

export function useSalvarDia() {
  const api = useApi();
  return useEscritaNaRotina((v: { routineId: number; dia_semana: number; nome: string }) =>
    api.rotina.salvarDia(v.routineId, v.dia_semana, v.nome),
  );
}

export function useRemoverDia() {
  const api = useApi();
  return useEscritaNaRotina((dayId: number) => api.rotina.removerDia(dayId));
}

export function useAdicionarExercicio() {
  const api = useApi();
  return useEscritaNaRotina((v: { dayId: number; entrada: ExercicioRotinaInput }) =>
    api.rotina.adicionarExercicio(v.dayId, v.entrada),
  );
}

export function useAtualizarExercicio() {
  const api = useApi();
  return useEscritaNaRotina((v: { id: number; entrada: ExercicioRotinaInput }) =>
    api.rotina.atualizarExercicio(v.id, v.entrada),
  );
}

export function useRemoverExercicio() {
  const api = useApi();
  return useEscritaNaRotina((id: number) => api.rotina.removerExercicio(id));
}

export function useReordenarExercicios() {
  const api = useApi();
  return useEscritaNaRotina((v: { dayId: number; ids: number[] }) =>
    api.rotina.reordenarExercicios(v.dayId, v.ids),
  );
}
