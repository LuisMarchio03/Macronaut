import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  listExercises, createExercise, updateExercise, deleteExercise, type ExInput,
} from "../repositories/exercises";

export function useExercises() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["exercises", userId],
    queryFn: () => listExercises(db, userId),
  });
}

export function useCreateExercise() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: ExInput) => createExercise(db, userId, e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useUpdateExercise() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, e }: { id: number; e: ExInput }) => updateExercise(db, userId, id, e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useDeleteExercise() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteExercise(db, userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}
