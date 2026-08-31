import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";

export function useWaterToday(data: string) {
  const api = useApi();
  return useQuery({ queryKey: ["water", data], queryFn: () => api["water"].getWaterTotal(data) });
}

export function useAddWater(data: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ml: number) => api["water"].addWater(data, ml),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", data] }),
  });
}

export function useResetWater(data: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api["water"].resetWater(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", data] }),
  });
}
