import { useQuery } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { listActivitySessionsByRange } from "../repositories/activities";

export function useAnaliseAtividade(inicio: string, fim: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-atividade", userId, inicio, fim],
    queryFn: () => listActivitySessionsByRange(db, userId, inicio, fim),
  });
}
