import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { listEntriesByDate, createEntry, deleteEntry, updateEntry } from "../repositories/entries";
import { getFoodsByIds } from "../repositories/foods";
import type { FoodEntry } from "../domain/types";

export function useTodayEntries(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["entries", data],
    queryFn: () => listEntriesByDate(db, userId, data),
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
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Omit<FoodEntry, "id" | "created_at">) => createEntry(db, userId, e),
    onSuccess: (_r, e) => qc.invalidateQueries({ queryKey: ["entries", e.data] }),
  });
}

export function useUpdateEntry(data: string) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (u: { id: number; qty_g?: number; meal_id?: number | null }) =>
      updateEntry(db, userId, u.id, { qty_g: u.qty_g, meal_id: u.meal_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", data] }),
  });
}

export function useDeleteEntry(data: string) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEntry(db, userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", data] }),
  });
}
