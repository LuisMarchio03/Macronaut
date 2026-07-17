import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  listTemplates, criarDeEntries, aplicar, deleteTemplate,
} from "../repositories/meal-templates";
import type { FoodEntry } from "../domain/types";

export function useTemplates(mealId: number | null) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["templates", mealId],
    queryFn: () => listTemplates(db, userId, mealId),
  });
}

export function useCriarTemplate() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { nome: string; mealId: number | null; entries: FoodEntry[] }) =>
      criarDeEntries(db, userId, p.nome, p.mealId, p.entries),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useAplicarTemplate(data: string) {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { templateId: number; mealId: number | null }) =>
      aplicar(db, userId, p.templateId, data, p.mealId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", data] });
      qc.invalidateQueries({ queryKey: ["historico"] });
    },
  });
}

export function useDeleteTemplate() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTemplate(db, userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
