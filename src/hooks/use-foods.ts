import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import {
  searchFoods, createFood, updateFood, deleteFood, listCustomFoods,
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
