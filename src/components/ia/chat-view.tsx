import { useEffect, useState } from "react";

import { AiStatusBadges } from "./ai-status-badges";
import { MessageList, type ChatMsg } from "./message-list";
import { ChatInput } from "./chat-input";
import { useAiHealth } from "../../hooks/use-ai-health";
import { useAiChat } from "../../hooks/use-ai-chat";
import { useAiConversation } from "../../hooks/use-ai-messages";

export function ChatView({
  config,
}: {
  config: { gemini_enabled: boolean; has_gemini_key: boolean };
}) {
  // O Gemini é o único provedor: não há seletor nem troca de conversa.
  const provider = "gemini" as const;
  const enabled = { gemini: config.gemini_enabled };
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const health = useAiHealth(true);
  const chat = useAiChat();
  const conv = useAiConversation(provider);

  // Semeia a conversa exibida a partir do histórico persistido no banco
  // (ao montar e após cada envio, quando useAiChat invalida ["ai-messages"]
  // e o refetch traz os turnos gravados). NUNCA limpa aqui: o reset baseado
  // na query causava corrida que apagava a msg otimista.
  useEffect(() => {
    if (conv.data) {
      setMessages(conv.data.messages);
      setSessionId(conv.data.sessionId);
    }
  }, [conv.data]);

  const semKeyGemini = !config.has_gemini_key;

  const enviar = (texto: string) => {
    setMessages((m) => [...m, { role: "user", content: texto }]);
    chat.mutate(
      { provider, message: texto, sessionId },
      {
        onSuccess: (res) => {
          setSessionId(res.sessionId);
          setMessages((m) => [...m, { role: "assistant", content: res.message }]);
        },
        onError: () => {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: "Não consegui contatar o serviço de IA agora." },
          ]);
        },
      },
    );
  };

  return (
    <div className="space-y-4 p-4">
      <AiStatusBadges health={health.data} enabled={enabled} />
      {semKeyGemini && (
        <p className="text-[0.8125rem] font-medium text-destructive">
          Cadastre sua chave do Gemini em Ajustes.
        </p>
      )}
      <MessageList messages={messages} />
      <ChatInput onSend={enviar} disabled={chat.isPending || semKeyGemini || conv.isLoading} />
    </div>
  );
}
