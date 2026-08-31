import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";
import type { ExInput } from "../repositories/exercises";

export function useExercises() {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["exercises", userId],
    queryFn: () => api["exercises"].listExercises(),
  });
}

export function useCreateExercise() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: ExInput) => api["exercises"].createExercise(e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useUpdateExercise() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, e }: { id: number; e: ExInput }) => api["exercises"].updateExercise(id, e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useDeleteExercise() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api["exercises"].deleteExercise(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}
