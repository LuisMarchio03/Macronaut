import { useQuery } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { getLatestSessionId, listMessages, type AiProvider } from "../repositories/ai";

export type LoadedConversation = {
  sessionId: string;
  messages: { role: "user" | "assistant"; content: string }[];
} | null;

export function useAiConversation(provider: AiProvider) {
  const db = useDb();
  const userId = useUserId();
  return useQuery<LoadedConversation>({
    queryKey: ["ai-messages", userId, provider],
    queryFn: async () => {
      const sessionId = await getLatestSessionId(db, userId, provider);
      if (!sessionId) return null;
      const msgs = await listMessages(db, userId, provider, sessionId);
      return { sessionId, messages: msgs.map((m) => ({ role: m.role, content: m.content })) };
    },
  });
}
