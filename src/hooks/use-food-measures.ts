import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";

import type { FoodMeasure } from "../domain/types";

export function useMeasures(foodId: number | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["measures", foodId],
    queryFn: () => api["food-measures"].listMeasures(foodId as number),
    enabled: foodId != null,
  });
}

export function useMeasuresByFoodIds(foodIds: number[]) {
  const api = useApi();
  const ids = [...new Set(foodIds)].sort((a, b) => a - b);
  return useQuery({
    queryKey: ["measures-by-ids", ids],
    queryFn: () => api["food-measures"].listMeasuresByFoodIds(ids),
    enabled: ids.length > 0,
  });
}

function useInvalidarMedidas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["measures"] });
    qc.invalidateQueries({ queryKey: ["measures-by-ids"] });
    qc.invalidateQueries({ queryKey: ["candidatos"] });
  };
}

export function useCreateMeasure() {
  const api = useApi();
  const invalidar = useInvalidarMedidas();
  return useMutation({
    mutationFn: (m: Omit<FoodMeasure, "id">) => api["food-measures"].createMeasure(m),
    onSuccess: invalidar,
  });
}

export function useUpdateMeasure() {
  const api = useApi();
  const invalidar = useInvalidarMedidas();
  return useMutation({
    mutationFn: ({ id, campos }: { id: number; campos: { nome?: string; qty_base?: number; ordem?: number } }) =>
      api["food-measures"].updateMeasure(id, campos),
    onSuccess: invalidar,
  });
}

export function useDeleteMeasure() {
  const api = useApi();
  const invalidar = useInvalidarMedidas();
  return useMutation({
    mutationFn: (id: number) => api["food-measures"].deleteMeasure(id),
    onSuccess: invalidar,
  });
}

export function useCandidatos(foodId: number | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["candidatos", foodId],
    queryFn: () => api["food-measures"].listCandidatos(foodId as number),
    enabled: foodId != null,
  });
}

export function useResolverCandidatas() {
  const api = useApi();
  const invalidar = useInvalidarMedidas();
  return useMutation({
    mutationFn: ({ foodId, pofCodigo }: { foodId: number; pofCodigo: string | null }) =>
      api["food-measures"].resolverCandidatas(foodId, pofCodigo),
    onSuccess: invalidar,
  });
}
