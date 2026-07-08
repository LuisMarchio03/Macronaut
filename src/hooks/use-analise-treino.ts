import { useQuery } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { listSessionsByRange, setsForAnalise } from "../repositories/workouts";

export function useAnaliseTreino(inicio: string, fim: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-treino", userId, inicio, fim],
    queryFn: async () => {
      const sessions = await listSessionsByRange(db, userId, inicio, fim);
      const sets = await setsForAnalise(db, userId, inicio, fim);
      return { nSessoes: sessions.length, sets };
    },
  });
}
