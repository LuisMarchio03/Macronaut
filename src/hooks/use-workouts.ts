import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";
import type { TipoSerie } from "../domain/types";
import type { SetInput } from "../repositories/workouts";

export function useSessionByDate(data: string) {
  const api = useApi();
  return useQuery({ queryKey: ["session", data], queryFn: () => api["workouts"].getSessionByDate(data) });
}

export function useListSessions() {
  const api = useApi();
  return useQuery({ queryKey: ["sessions"], queryFn: () => api["workouts"].listSessions() });
}

export function useCreateSession() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: { data: string; nome: string | null }) => api["workouts"].createSession(s),
    onSuccess: (_r, s) => {
      qc.invalidateQueries({ queryKey: ["session", s.data] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api["workouts"].deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: ["session-sets"] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
    },
  });
}

export function useSessionSets(sessionId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["session-sets", sessionId],
    queryFn: () => api["workouts"].listSetsBySession(sessionId as number),
    enabled: sessionId != null,
  });
}

export function useAddSet(sessionId: number | undefined) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: SetInput) => api["workouts"].addSet(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", sessionId] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
      qc.invalidateQueries({ queryKey: ["ultima-vez"] });
    },
  });
}

export function useDeleteSet(sessionId: number | undefined) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api["workouts"].deleteSet(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", sessionId] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
      qc.invalidateQueries({ queryKey: ["ultima-vez"] });
    },
  });
}

export function useUpdateSet(sessionId: number | undefined) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (u: {
      id: number; reps?: number; peso_kg?: number;
      tipo?: TipoSerie; rir?: number | null; nota?: string | null;
    }) => api["workouts"].updateSet(u.id, {
      reps: u.reps, peso_kg: u.peso_kg, tipo: u.tipo, rir: u.rir, nota: u.nota,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", sessionId] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
      qc.invalidateQueries({ queryKey: ["ultima-vez"] });
    },
  });
}

export function useSetsForExercise(exerciseId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["sets-exercise", exerciseId],
    queryFn: () => api["workouts"].setsForExercise(exerciseId as number),
    enabled: exerciseId != null,
  });
}

export function useUltimaVez(exerciseId: number | undefined, antesDe: string) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["ultima-vez", userId, exerciseId, antesDe],
    queryFn: () => api["workouts"].ultimaVezExercicio(exerciseId as number, antesDe),
    enabled: exerciseId != null,
  });
}

export function useUpdateSession(data: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (u: { id: number; nome?: string | null; nota?: string | null }) =>
      api["workouts"].updateSession(u.id, { nome: u.nome, nota: u.nota }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", data] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

/** As últimas sessões do exercício — o insumo da prescrição de hoje. */
export function useHistoricoExercicio(
  exerciseId: number | undefined,
  antesDe: string,
  limite = 3,
) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["historico-exercicio", userId, exerciseId, antesDe, limite],
    queryFn: () => api["workouts"].historicoExercicio(exerciseId as number, antesDe, limite),
    enabled: exerciseId != null,
  });
}
