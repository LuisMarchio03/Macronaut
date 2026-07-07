import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import { listMeals, createMeal, updateMeal, deleteMeal } from "../repositories/meals";
import type { Meal } from "../domain/types";

export function useMeals() {
  const db = useDb();
  return useQuery({ queryKey: ["meals"], queryFn: () => listMeals(db) });
}

export function useCreateMeal() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Omit<Meal, "id">) => createMeal(db, m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useUpdateMeal() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, m }: { id: number; m: Omit<Meal, "id"> }) => updateMeal(db, id, m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useDeleteMeal() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteMeal(db, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}
