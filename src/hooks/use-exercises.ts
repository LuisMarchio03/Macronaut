import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import { listExercises, createExercise, updateExercise, deleteExercise } from "../repositories/exercises";

type ExInput = { nome: string; grupo_muscular: string | null };

export function useExercises() {
  const db = useDb();
  return useQuery({ queryKey: ["exercises"], queryFn: () => listExercises(db) });
}

export function useCreateExercise() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: ExInput) => createExercise(db, e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useUpdateExercise() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, e }: { id: number; e: ExInput }) => updateExercise(db, id, e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useDeleteExercise() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteExercise(db, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}
