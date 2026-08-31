import { useQuery } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";

export function useAnaliseNutricao(inicio: string, fim: string) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-nutricao", userId, inicio, fim],
    queryFn: async () => {
      const entries = await api["entries"].listEntriesByRange(inicio, fim);
      const ids = [...new Set(entries.map((e) => e.food_id))];
      const foodsById = await api["foods"].getFoodsByIds(ids);
      return { entries, foodsById };
    },
  });
}
