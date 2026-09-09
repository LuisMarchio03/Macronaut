import { useQuery } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";

export function useAnaliseAgua(inicio: string, fim: string) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-agua", userId, inicio, fim],
    queryFn: () => api["water"].getWaterByRange(inicio, fim),
  });
}
