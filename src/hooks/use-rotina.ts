import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  adicionarExercicio,
  atualizarExercicio,
  criarRotina,
  getRotinaAtiva,
  listDias,
  listExercicios,
  listExerciciosDaRotina,
  removerDia,
  removerExercicio,
  reordenarExercicios,
  salvarDia,
  type ExercicioRotinaInput,
  type Rotina,
} from "../repositories/rotina";

const CHAVE = {
  raiz: ["rotina"] as const,
  ativa: ["rotina", "ativa"] as const,
  dias: (id?: number) => ["rotina", "dias", id] as const,
  exercicios: (dayId?: number) => ["rotina", "exercicios", dayId] as const,
  todos: (id?: number) => ["rotina", "todos", id] as const,
};

export function useRotinaAtiva() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: CHAVE.ativa, queryFn: () => getRotinaAtiva(db, userId) });
}

export function useDiasDaRotina(rotina: Rotina | null | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.dias(rotina?.id),
    queryFn: () => listDias(db, userId, rotina!.id),
    enabled: rotina != null,
  });
}

export function useExerciciosDoDia(dayId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.exercicios(dayId),
    queryFn: () => listExercicios(db, userId, dayId!),
    enabled: dayId != null,
  });
}

export function useExerciciosDaRotina(rotina: Rotina | null | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.todos(rotina?.id),
    queryFn: () => listExerciciosDaRotina(db, userId, rotina!.id),
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
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((nome: string) => criarRotina(db, userId, nome));
}

export function useSalvarDia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((v: { routineId: number; dia_semana: number; nome: string }) =>
    salvarDia(db, userId, v.routineId, v.dia_semana, v.nome),
  );
}

export function useRemoverDia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((dayId: number) => removerDia(db, userId, dayId));
}

export function useAdicionarExercicio() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((v: { dayId: number; entrada: ExercicioRotinaInput }) =>
    adicionarExercicio(db, userId, v.dayId, v.entrada),
  );
}

export function useAtualizarExercicio() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((v: { id: number; entrada: ExercicioRotinaInput }) =>
    atualizarExercicio(db, userId, v.id, v.entrada),
  );
}

export function useRemoverExercicio() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((id: number) => removerExercicio(db, userId, id));
}

export function useReordenarExercicios() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((v: { dayId: number; ids: number[] }) =>
    reordenarExercicios(db, userId, v.dayId, v.ids),
  );
}
