import { Navigate } from "react-router-dom";
import { HudPanel } from "../components/ui/hud-panel";
import { ChatView } from "../components/ia/chat-view";
import { useAiConfig } from "../hooks/use-ai-config";

export function Ia() {
  const { data: config, isLoading } = useAiConfig();
  if (isLoading) return <div className="p-4">Carregando…</div>;
  if (!config || (!config.aloy_enabled && !config.gemini_enabled)) return <Navigate to="/ajustes" replace />;
  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-1">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-primary/70">Central · ia</p>
        <h1 className="text-2xl font-semibold tracking-tight">Assistente</h1>
      </header>
      <HudPanel label="Console" bodyClassName="p-0">
        <ChatView config={config} />
      </HudPanel>
    </div>
  );
}
