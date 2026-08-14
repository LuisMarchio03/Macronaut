import { Navigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { BackLink, Page, PageHeader } from "../components/ui/page";
import { SkeletonCard } from "../components/ui/skeleton";
import { ChatView } from "../components/ia/chat-view";
import { useAiConfig } from "../hooks/use-ai-config";

export function Ia() {
  const { data: config, isLoading } = useAiConfig();
  if (isLoading)
    return (
      <Page>
        <SkeletonCard />
      </Page>
    );
  if (!config || (!config.aloy_enabled && !config.gemini_enabled)) return <Navigate to="/ajustes" replace />;
  return (
    <Page>
      <PageHeader eyebrow={<BackLink to="/mais">Mais</BackLink>} title="Assistente" />
      <Card padded={false}>
        <ChatView config={config} />
      </Card>
    </Page>
  );
}