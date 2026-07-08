import { useQuery } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { getWaterByRange } from "../repositories/water";

export function useAnaliseAgua(inicio: string, fim: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["analise-agua", userId, inicio, fim],
    queryFn: () => getWaterByRange(db, userId, inicio, fim),
  });
}
