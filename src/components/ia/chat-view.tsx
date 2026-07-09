import { useEffect, useState } from "react";
import { HudPanel } from "../ui/hud-panel";
import { ProviderSelector } from "./provider-selector";
import { AiStatusBadges } from "./ai-status-badges";
import { MessageList, type ChatMsg } from "./message-list";
import { ChatInput } from "./chat-input";
import { useAiHealth } from "../../hooks/use-ai-health";
import { useAiChat } from "../../hooks/use-ai-chat";
import { useAiConversation } from "../../hooks/use-ai-messages";

type Provider = "gemini" | "aloy";

export function ChatView({
  config,
}: {
  config: { aloy_enabled: boolean; gemini_enabled: boolean; has_gemini_key: boolean };
}) {
  const enabled = { gemini: config.gemini_enabled, aloy: config.aloy_enabled };
  const inicial: Provider = enabled.gemini ? "gemini" : "aloy";
  const [provider, setProvider] = useState<Provider>(inicial);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const health = useAiHealth(true);
  const chat = useAiChat();
  const conv = useAiConversation(provider);

  // Semeia a conversa exibida a partir do histórico persistido no banco
  // (ao montar, ao trocar de provedor via nova queryKey, e após cada envio,
  // quando useAiChat invalida ["ai-messages"] e o refetch traz os turnos
  // gravados). NUNCA limpa aqui — limpar é só responsabilidade do `trocar`;
  // o reset baseado na query causava corrida que apagava a msg otimista.
  useEffect(() => {
    if (conv.data) {
      setMessages(conv.data.messages);
      setSessionId(conv.data.sessionId);
    }
  }, [conv.data]);

  const semKeyGemini = provider === "gemini" && !config.has_gemini_key;

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

  // troca de provedor reinicia a conversa visível (sessões são por provedor);
  // o histórico do novo provedor é recarregado pelo efeito acima.
  const trocar = (p: Provider) => {
    if (p === provider) return;
    setProvider(p);
    setMessages([]);
    setSessionId(undefined);
  };

  return (
    <HudPanel label={`IA · ${provider}`} bodyClassName="space-y-4 p-4">
      <AiStatusBadges health={health.data} enabled={enabled} />
      <ProviderSelector enabled={enabled} value={provider} onChange={trocar} health={health.data} />
      {semKeyGemini && (
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-destructive">
          Cadastre sua chave do Gemini em Ajustes.
        </p>
      )}
      <MessageList messages={messages} />
      <ChatInput onSend={enviar} disabled={chat.isPending || semKeyGemini || conv.isLoading} />
    </HudPanel>
  );
}
