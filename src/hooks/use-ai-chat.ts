import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "../lib/db-context";
import { useAuth } from "../lib/auth-context";
import { postChat, type ChatRes } from "../lib/ai-gateway";

export function useAiChat() {
  const userId = useUserId();
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { provider: "gemini" | "aloy"; message: string; sessionId?: string }): Promise<ChatRes> =>
      postChat(session!.token, { userId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-messages"] }),
  });
}
