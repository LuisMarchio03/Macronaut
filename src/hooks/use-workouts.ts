import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import type { TipoSerie } from "../domain/types";
import {
  createSession, getSessionByDate, listSessions, deleteSession,
  addSet, listSetsBySession, deleteSet, setsForExercise, updateSet,
  ultimaVezExercicio, updateSession, type SetInput,
} from "../repositories/workouts";

export function useSessionByDate(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: ["session", data], queryFn: () => getSessionByDate(db, userId, data) });
}

export function useListSessions() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: ["sessions"], queryFn: () => listSessions(db, userId) });
}

export function useCreateSession() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: { data: string; nome: string | null }) => createSession(db, userId, s),
    onSuccess: (_r, s) => {
      qc.invalidateQueries({ queryKey: ["session", s.data] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSession(db, userId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: ["session-sets"] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
    },
  });
}

export function useSessionSets(sessionId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["session-sets", sessionId],
    queryFn: () => listSetsBySession(db, userId, sessionId as number),
    enabled: sessionId != null,
  });
}

export function useAddSet(sessionId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: SetInput) => addSet(db, userId, s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", sessionId] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
      qc.invalidateQueries({ queryKey: ["ultima-vez"] });
    },
  });
}

export function useDeleteSet(sessionId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSet(db, userId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", sessionId] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
      qc.invalidateQueries({ queryKey: ["ultima-vez"] });
    },
  });
}

export function useUpdateSet(sessionId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (u: {
      id: number; reps?: number; peso_kg?: number;
      tipo?: TipoSerie; rir?: number | null; nota?: string | null;
    }) => updateSet(db, userId, u.id, {
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
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sets-exercise", exerciseId],
    queryFn: () => setsForExercise(db, userId, exerciseId as number),
    enabled: exerciseId != null,
  });
}

export function useUltimaVez(exerciseId: number | undefined, antesDe: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["ultima-vez", userId, exerciseId, antesDe],
    queryFn: () => ultimaVezExercicio(db, userId, exerciseId as number, antesDe),
    enabled: exerciseId != null,
  });
}

export function useUpdateSession(data: string) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (u: { id: number; nome?: string | null; nota?: string | null }) =>
      updateSession(db, userId, u.id, { nome: u.nome, nota: u.nota }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", data] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
