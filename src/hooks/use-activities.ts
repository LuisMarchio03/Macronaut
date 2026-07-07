import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import {
  listActivityTypes, createActivitySession, listActivitySessions, deleteActivitySession,
} from "../repositories/activities";

export function useActivityTypes() {
  const db = useDb();
  return useQuery({ queryKey: ["activity-types"], queryFn: () => listActivityTypes(db) });
}

export function useActivitySessions() {
  const db = useDb();
  return useQuery({ queryKey: ["activity-sessions"], queryFn: () => listActivitySessions(db) });
}

export function useCreateActivity() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { data: string; tipo: string; duracao_min: number; kcal: number }) =>
      createActivitySession(db, a),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-sessions"] }),
  });
}

export function useDeleteActivity() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteActivitySession(db, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-sessions"] }),
  });
}
