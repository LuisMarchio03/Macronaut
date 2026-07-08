import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  listActivityTypes, createActivitySession, listActivitySessions, deleteActivitySession,
} from "../repositories/activities";

export function useActivityTypes() {
  const db = useDb();
  return useQuery({ queryKey: ["activity-types"], queryFn: () => listActivityTypes(db) });
}

export function useActivitySessions() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: ["activity-sessions"], queryFn: () => listActivitySessions(db, userId) });
}

export function useCreateActivity() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { data: string; tipo: string; duracao_min: number; kcal: number }) =>
      createActivitySession(db, userId, a),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-sessions"] }),
  });
}

export function useDeleteActivity() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteActivitySession(db, userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-sessions"] }),
  });
}
