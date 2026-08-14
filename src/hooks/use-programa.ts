import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  atualizarIncremento,
  atualizarTM,
  concluirSessao,
  criarPrograma,
  desfazerSessao,
  getProgramaAtivo,
  listLevantamentos,
  listSessoesDoPrograma,
  marcasAmrap,
  posicaoAtual,
  type LevantamentoInput,
  type Programa,
  type SerieRegistrada,
} from "../repositories/programa";

const CHAVE = {
  ativo: ["programa", "ativo"] as const,
  lifts: (id?: number) => ["programa", "lifts", id] as const,
  posicao: (id?: number) => ["programa", "posicao", id] as const,
  sessoes: (id?: number) => ["programa", "sessoes", id] as const,
  amrap: (exId?: number) => ["programa", "amrap", exId] as const,
};

export function useProgramaAtivo() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: CHAVE.ativo, queryFn: () => getProgramaAtivo(db, userId) });
}

export function useLevantamentos(programa: Programa | null | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.lifts(programa?.id),
    queryFn: () => listLevantamentos(db, userId, programa!),
    enabled: programa != null,
  });
}

export function usePosicao(programa: Programa | null | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.posicao(programa?.id),
    queryFn: () => posicaoAtual(db, userId, programa!),
    enabled: programa != null,
  });
}

export function useSessoesDoPrograma(programa: Programa | null | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.sessoes(programa?.id),
    queryFn: () => listSessoesDoPrograma(db, userId, programa!.id),
    enabled: programa != null,
  });
}

/** Marcas de AMRAP do levantamento, para o recorde a bater. */
export function useMarcasAmrap(exerciseId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.amrap(exerciseId),
    queryFn: () => marcasAmrap(db, userId, exerciseId!),
    enabled: exerciseId != null,
  });
}

export function useCriarPrograma() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entrada: {
      nome: string;
      incremento_kg: number;
      levantamentos: LevantamentoInput[];
    }) => criarPrograma(db, userId, entrada),
    // Invalida a raiz: programa novo troca levantamentos, posição e histórico
    // de uma vez.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programa"] }),
  });
}

export function useConcluirSessao() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entrada: {
      programId: number;
      liftId: number;
      ciclo: number;
      semana: number;
      tm_kg: number;
      data: string;
      nome: string;
      series: SerieRegistrada[];
    }) => concluirSessao(db, userId, entrada),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["programa"] });
      // As séries entram em workout_sets: o histórico e a progressão mudam.
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDesfazerSessao() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (programSessionId: number) => desfazerSessao(db, userId, programSessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["programa"] });
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useAtualizarTM() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ liftId, tm_kg }: { liftId: number; tm_kg: number }) =>
      atualizarTM(db, liftId, tm_kg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programa"] }),
  });
}

export function useAtualizarIncremento() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programId, incremento_kg }: { programId: number; incremento_kg: number }) =>
      atualizarIncremento(db, userId, programId, incremento_kg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programa"] }),
  });
}
