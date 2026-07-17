import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import {
  searchFoods, getFoodsByIds, createFood, updateFood, deleteFood, listCustomFoods,
} from "../repositories/foods";
import type { Food } from "../domain/types";

type FoodInput = Omit<Food, "id" | "source" | "created_at">;

export function useFoods(termo: string) {
  const db = useDb();
  return useQuery({
    queryKey: ["foods", termo],
    queryFn: () => searchFoods(db, termo),
    enabled: termo.trim().length > 0,
  });
}

export function useCustomFoods() {
  const db = useDb();
  return useQuery({ queryKey: ["custom-foods"], queryFn: () => listCustomFoods(db) });
}

/**
 * Alimentos por id. Mesma queryKey de `useFoodsForEntries` (use-today-entries),
 * de propósito: as duas leem o mesmo dado e compartilham cache.
 */
export function useFoodsByIds(ids: number[]) {
  const db = useDb();
  const chaves = [...new Set(ids)].sort((a, b) => a - b);
  return useQuery({
    queryKey: ["foods-by-ids", chaves],
    queryFn: () => getFoodsByIds(db, chaves),
    enabled: chaves.length > 0,
  });
}

export function useCreateFood() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: FoodInput) => createFood(db, f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-foods"] });
      qc.invalidateQueries({ queryKey: ["foods"] });
    },
  });
}

export function useUpdateFood() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, f }: { id: number; f: FoodInput }) => updateFood(db, id, f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-foods"] });
      qc.invalidateQueries({ queryKey: ["foods"] });
      qc.invalidateQueries({ queryKey: ["foods-by-ids"] });
    },
  });
}

export function useDeleteFood() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteFood(db, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-foods"] });
      qc.invalidateQueries({ queryKey: ["foods"] });
      qc.invalidateQueries({ queryKey: ["foods-by-ids"] });
    },
  });
}
