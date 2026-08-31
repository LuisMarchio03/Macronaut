import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";

import type { FoodEntry } from "../domain/types";

export function useTemplates(mealId: number | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["templates", mealId],
    queryFn: () => api["meal-templates"].listTemplates(mealId),
  });
}

export function useTemplatesWithKcal(mealId: number | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["templates", "kcal", mealId],
    queryFn: () => api["meal-templates"].listTemplatesWithKcal(mealId),
  });
}

export function useCriarTemplate() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { nome: string; mealId: number | null; entries: FoodEntry[] }) =>
      api["meal-templates"].criarDeEntries(p.nome, p.mealId, p.entries),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useAplicarTemplate(data: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { templateId: number; mealId: number | null }) =>
      api["meal-templates"].aplicar(p.templateId, data, p.mealId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", data] });
      qc.invalidateQueries({ queryKey: ["historico"] });
    },
  });
}

export function useDeleteTemplate() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api["meal-templates"].deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
