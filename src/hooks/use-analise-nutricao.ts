import { useQuery } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { listEntriesByRange } from "../repositories/entries";
import { getFoodsByIds } from "../repositories/foods";

export function useAnaliseNutricao(inicio: string, fim: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-nutricao", userId, inicio, fim],
    queryFn: async () => {
      const entries = await listEntriesByRange(db, userId, inicio, fim);
      const ids = [...new Set(entries.map((e) => e.food_id))];
      const foodsById = await getFoodsByIds(db, ids);
      return { entries, foodsById };
    },
  });
}
