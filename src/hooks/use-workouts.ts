import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  createSession, getSessionByDate, listSessions, deleteSession,
  addSet, listSetsBySession, deleteSet, setsForExercise, updateSet,
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
    mutationFn: (s: { session_id: number; exercise_id: number; ordem: number; reps: number; peso_kg: number }) =>
      addSet(db, userId, s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", sessionId] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
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
    },
  });
}

export function useUpdateSet(sessionId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (u: { id: number; reps?: number; peso_kg?: number }) =>
      updateSet(db, userId, u.id, { reps: u.reps, peso_kg: u.peso_kg }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", sessionId] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
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
