import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";

import { hoje } from "../lib/date";

export function useAnalisePeso(inicio: string, fim: string) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-peso", userId, inicio, fim],
    queryFn: () => api["weighins"].getWeighInsByRange(inicio, fim),
  });
}

export function useRegistrarPeso() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (peso_kg: number) => api["weighins"].upsertWeighIn(hoje(), peso_kg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analise-peso"] }),
  });
}
