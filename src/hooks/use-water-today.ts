import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { getWaterTotal, addWater, resetWater } from "../repositories/water";

export function useWaterToday(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: ["water", data], queryFn: () => getWaterTotal(db, userId, data) });
}

export function useAddWater(data: string) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ml: number) => addWater(db, userId, data, ml),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", data] }),
  });
}

export function useResetWater(data: string) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resetWater(db, userId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", data] }),
  });
}
