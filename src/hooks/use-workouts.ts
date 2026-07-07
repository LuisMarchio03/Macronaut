import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import {
  createSession, getSessionByDate, listSessions, deleteSession,
  addSet, listSetsBySession, deleteSet, setsForExercise,
} from "../repositories/workouts";

export function useSessionByDate(data: string) {
  const db = useDb();
  return useQuery({ queryKey: ["session", data], queryFn: () => getSessionByDate(db, data) });
}

export function useListSessions() {
  const db = useDb();
  return useQuery({ queryKey: ["sessions"], queryFn: () => listSessions(db) });
}

export function useCreateSession() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: { data: string; nome: string | null }) => createSession(db, s),
    onSuccess: (_r, s) => {
      qc.invalidateQueries({ queryKey: ["session", s.data] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSession(db, id),
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
  return useQuery({
    queryKey: ["session-sets", sessionId],
    queryFn: () => listSetsBySession(db, sessionId as number),
    enabled: sessionId != null,
  });
}

export function useAddSet(sessionId: number | undefined) {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: { session_id: number; exercise_id: number; ordem: number; reps: number; peso_kg: number }) =>
      addSet(db, s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", sessionId] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
    },
  });
}

export function useDeleteSet(sessionId: number | undefined) {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSet(db, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-sets", sessionId] });
      qc.invalidateQueries({ queryKey: ["sets-exercise"] });
    },
  });
}

export function useSetsForExercise(exerciseId: number | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: ["sets-exercise", exerciseId],
    queryFn: () => setsForExercise(db, exerciseId as number),
    enabled: exerciseId != null,
  });
}
