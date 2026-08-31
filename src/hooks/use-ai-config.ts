import { useQuery } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";

export function useAiConfig() {
  const api = useApi();
  const userId = useUserId();
  return useQuery({ queryKey: ["ai-config", userId], queryFn: () => api["ai"].getAiConfig() });
}
