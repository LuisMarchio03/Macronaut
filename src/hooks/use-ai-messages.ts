import { useQuery } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";
import type { AiProvider } from "../repositories/ai";

export type LoadedConversation = {
  sessionId: string;
  messages: { role: "user" | "assistant"; content: string }[];
} | null;

export function useAiConversation(provider: AiProvider) {
  const api = useApi();
  const userId = useUserId();
  return useQuery<LoadedConversation>({
    queryKey: ["ai-messages", userId, provider],
    queryFn: async () => {
      const sessionId = await api["ai"].getLatestSessionId(provider);
      if (!sessionId) return null;
      const msgs = await api["ai"].listMessages(provider, sessionId);
      return { sessionId, messages: msgs.map((m) => ({ role: m.role, content: m.content })) };
    },
  });
}
