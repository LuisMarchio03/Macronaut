import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";

import type { Food } from "../domain/types";

type FoodInput = Omit<Food, "id" | "source" | "created_at">;

export function useFoods(termo: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["foods", termo],
    queryFn: () => api["foods"].searchFoods(termo),
    enabled: termo.trim().length > 0,
  });
}

/** A base inteira, filtrada — a lista que a tela de alimentos folheia. */
export function useCatalogoFoods(filtro: { termo?: string; categoria?: string; apenasMeus?: boolean }) {
  const api = useApi();
  return useQuery({
    queryKey: ["foods-catalogo", filtro.termo ?? "", filtro.categoria ?? "", filtro.apenasMeus ?? false],
    queryFn: () => api["foods"].listFoods(filtro),
  });
}

export function useCategoriasFood() {
  const api = useApi();
  return useQuery({ queryKey: ["foods-categorias"], queryFn: () => api["foods"].listCategorias() });
}

export function useCustomFoods() {
  const api = useApi();
  return useQuery({ queryKey: ["custom-foods"], queryFn: () => api["foods"].listCustomFoods() });
}

/**
 * Alimentos por id. Mesma queryKey de `useFoodsForEntries` (use-today-entries),
 * de propósito: as duas leem o mesmo dado e compartilham cache.
 */
export function useFoodsByIds(ids: number[]) {
  const api = useApi();
  const chaves = [...new Set(ids)].sort((a, b) => a - b);
  return useQuery({
    queryKey: ["foods-by-ids", chaves],
    queryFn: () => api["foods"].getFoodsByIds(chaves),
    enabled: chaves.length > 0,
  });
}

export function useCreateFood() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: FoodInput) => api["foods"].createFood(f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-foods"] });
      qc.invalidateQueries({ queryKey: ["foods"] });
      qc.invalidateQueries({ queryKey: ["foods-catalogo"] });
      qc.invalidateQueries({ queryKey: ["foods-categorias"] });
    },
  });
}

export function useUpdateFood() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, f }: { id: number; f: FoodInput }) => api["foods"].updateFood(id, f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-foods"] });
      qc.invalidateQueries({ queryKey: ["foods"] });
      qc.invalidateQueries({ queryKey: ["foods-by-ids"] });
      qc.invalidateQueries({ queryKey: ["foods-catalogo"] });
      qc.invalidateQueries({ queryKey: ["foods-categorias"] });
    },
  });
}

export function useDeleteFood() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api["foods"].deleteFood(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-foods"] });
      qc.invalidateQueries({ queryKey: ["foods"] });
      qc.invalidateQueries({ queryKey: ["foods-by-ids"] });
      qc.invalidateQueries({ queryKey: ["foods-catalogo"] });
      qc.invalidateQueries({ queryKey: ["foods-categorias"] });
    },
  });
}
