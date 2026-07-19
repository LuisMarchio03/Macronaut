import { Navigate } from "react-router-dom";
import { Bot } from "lucide-react";
import { SectionCard } from "../components/ui/section-card";
import { SkeletonCard } from "../components/ui/skeleton";
import { ChatView } from "../components/ia/chat-view";
import { useAiConfig } from "../hooks/use-ai-config";

export function Ia() {
  const { data: config, isLoading } = useAiConfig();
  if (isLoading) return <div className="p-4"><SkeletonCard /></div>;
  if (!config || (!config.aloy_enabled && !config.gemini_enabled)) return <Navigate to="/ajustes" replace />;
  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-2">
        <p className="section-title">Assistente</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="flex items-center gap-2">
            <Bot className="size-6 text-primary" /> Assistente IA
          </span>
        </h1>
      </header>
      <SectionCard variant="gradient" header="Console" bodyClassName="p-0">
        <ChatView config={config} />
      </SectionCard>
    </div>
  );
}