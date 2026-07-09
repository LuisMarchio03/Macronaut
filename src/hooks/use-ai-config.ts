import { useQuery } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { getAiConfig } from "../repositories/ai";

export function useAiConfig() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: ["ai-config", userId], queryFn: () => getAiConfig(db, userId) });
}
