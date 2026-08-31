import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";

import type { Meal } from "../domain/types";

export function useMeals() {
  const api = useApi();
  return useQuery({ queryKey: ["meals"], queryFn: () => api["meals"].listMeals() });
}

export function useCreateMeal() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Omit<Meal, "id">) => api["meals"].createMeal(m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useUpdateMeal() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, m }: { id: number; m: Omit<Meal, "id"> }) => api["meals"].updateMeal(id, m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useDeleteMeal() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api["meals"].deleteMeal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useReordenarMeals() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => api["meals"].reordenarMeals(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}
