import { useQuery } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";

export function useAnaliseTreino(inicio: string, fim: string) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-treino", userId, inicio, fim],
    queryFn: async () => {
      const sessions = await api["workouts"].listSessionsByRange(inicio, fim);
      const sets = await api["workouts"].setsForAnalise(inicio, fim);
      return { nSessoes: sessions.length, sets };
    },
  });
}
