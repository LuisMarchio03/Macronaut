import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { getWeighInsByRange, upsertWeighIn } from "../repositories/weighins";
import { hoje } from "../lib/date";

export function useAnalisePeso(inicio: string, fim: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-peso", userId, inicio, fim],
    queryFn: () => getWeighInsByRange(db, userId, inicio, fim),
  });
}

export function useRegistrarPeso() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (peso_kg: number) => upsertWeighIn(db, userId, hoje(), peso_kg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analise-peso"] }),
  });
}
