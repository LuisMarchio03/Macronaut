import { useQuery } from "@tanstack/react-query";
import { useUserId } from "../lib/db-context";
import { useAuth } from "../lib/auth-context";
import { getHealth } from "../lib/ai-gateway";

export function useAiHealth(enabled: boolean) {
  const userId = useUserId();
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ai-health", userId],
    queryFn: () => getHealth(session!.token, userId),
    enabled: enabled && !!session,
    refetchInterval: 20_000,
    retry: false,
  });
}
