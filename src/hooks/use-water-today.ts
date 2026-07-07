import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import { getWaterTotal, addWater, resetWater } from "../repositories/water";

export function useWaterToday(data: string) {
  const db = useDb();
  return useQuery({ queryKey: ["water", data], queryFn: () => getWaterTotal(db, data) });
}

export function useAddWater(data: string) {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ml: number) => addWater(db, data, ml),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", data] }),
  });
}

export function useResetWater(data: string) {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resetWater(db, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", data] }),
  });
}
