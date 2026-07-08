import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { listMeals, createMeal, updateMeal, deleteMeal } from "../repositories/meals";
import type { Meal } from "../domain/types";

export function useMeals() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: ["meals"], queryFn: () => listMeals(db, userId) });
}

export function useCreateMeal() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Omit<Meal, "id">) => createMeal(db, userId, m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useUpdateMeal() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, m }: { id: number; m: Omit<Meal, "id"> }) => updateMeal(db, userId, id, m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useDeleteMeal() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteMeal(db, userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}
