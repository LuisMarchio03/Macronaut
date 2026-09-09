import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";

import type { FoodEntry } from "../domain/types";

export function useTodayEntries(data: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["entries", data],
    queryFn: () => api["entries"].listEntriesByDate(data),
  });
}

export function useFoodsForEntries(entries: FoodEntry[]) {
  const api = useApi();
  const ids = [...new Set(entries.map((e) => e.food_id))].sort((a, b) => a - b);
  return useQuery({
    queryKey: ["foods-by-ids", ids],
    queryFn: () => api["foods"].getFoodsByIds(ids),
    enabled: ids.length > 0,
  });
}

export function useAddEntry() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Omit<FoodEntry, "id" | "created_at">) => api["entries"].createEntry(e),
    onSuccess: (_r, e) => qc.invalidateQueries({ queryKey: ["entries", e.data] }),
  });
}

export function useUpdateEntry(data: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (u: {
      id: number;
      qty_g?: number;
      meal_id?: number | null;
      measure_id?: number | null;
      measure_count?: number | null;
    }) =>
      api["entries"].updateEntry(u.id, {
        qty_g: u.qty_g,
        meal_id: u.meal_id,
        measure_id: u.measure_id,
        measure_count: u.measure_count,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", data] }),
  });
}

export function useDeleteEntry(data: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api["entries"].deleteEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", data] }),
  });
}
