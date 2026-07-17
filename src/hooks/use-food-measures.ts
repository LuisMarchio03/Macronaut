import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import {
  listMeasures, listMeasuresByFoodIds, createMeasure, updateMeasure, deleteMeasure,
  listCandidatos, resolverCandidatas,
} from "../repositories/food-measures";
import type { FoodMeasure } from "../domain/types";

export function useMeasures(foodId: number | null) {
  const db = useDb();
  return useQuery({
    queryKey: ["measures", foodId],
    queryFn: () => listMeasures(db, foodId as number),
    enabled: foodId != null,
  });
}

export function useMeasuresByFoodIds(foodIds: number[]) {
  const db = useDb();
  const ids = [...new Set(foodIds)].sort((a, b) => a - b);
  return useQuery({
    queryKey: ["measures-by-ids", ids],
    queryFn: () => listMeasuresByFoodIds(db, ids),
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
  const db = useDb();
  const invalidar = useInvalidarMedidas();
  return useMutation({
    mutationFn: (m: Omit<FoodMeasure, "id">) => createMeasure(db, m),
    onSuccess: invalidar,
  });
}

export function useUpdateMeasure() {
  const db = useDb();
  const invalidar = useInvalidarMedidas();
  return useMutation({
    mutationFn: ({ id, campos }: { id: number; campos: { nome?: string; qty_base?: number; ordem?: number } }) =>
      updateMeasure(db, id, campos),
    onSuccess: invalidar,
  });
}

export function useDeleteMeasure() {
  const db = useDb();
  const invalidar = useInvalidarMedidas();
  return useMutation({
    mutationFn: (id: number) => deleteMeasure(db, id),
    onSuccess: invalidar,
  });
}

export function useCandidatos(foodId: number | null) {
  const db = useDb();
  return useQuery({
    queryKey: ["candidatos", foodId],
    queryFn: () => listCandidatos(db, foodId as number),
    enabled: foodId != null,
  });
}

export function useResolverCandidatas() {
  const db = useDb();
  const invalidar = useInvalidarMedidas();
  return useMutation({
    mutationFn: ({ foodId, pofCodigo }: { foodId: number; pofCodigo: string | null }) =>
      resolverCandidatas(db, foodId, pofCodigo),
    onSuccess: invalidar,
  });
}
