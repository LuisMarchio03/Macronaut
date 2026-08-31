import { useQuery } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";

export function useAnaliseAtividade(inicio: string, fim: string) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-atividade", userId, inicio, fim],
    queryFn: () => api["activities"].listActivitySessionsByRange(inicio, fim),
  });
}
