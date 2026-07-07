import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import { listEntriesByDate, createEntry, deleteEntry } from "../repositories/entries";
import { getFoodsByIds } from "../repositories/foods";
import type { FoodEntry } from "../domain/types";

export function useTodayEntries(data: string) {
  const db = useDb();
  return useQuery({
    queryKey: ["entries", data],
    queryFn: () => listEntriesByDate(db, data),
  });
}

export function useFoodsForEntries(entries: FoodEntry[]) {
  const db = useDb();
  const ids = [...new Set(entries.map((e) => e.food_id))].sort((a, b) => a - b);
  return useQuery({
    queryKey: ["foods-by-ids", ids],
    queryFn: () => getFoodsByIds(db, ids),
    enabled: ids.length > 0,
  });
}

export function useAddEntry() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Omit<FoodEntry, "id" | "created_at">) => createEntry(db, e),
    onSuccess: (_r, e) => qc.invalidateQueries({ queryKey: ["entries", e.data] }),
  });
}

export function useDeleteEntry(data: string) {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEntry(db, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", data] }),
  });
}
