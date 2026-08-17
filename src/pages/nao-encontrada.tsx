import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Page, PageHeader } from "@/components/ui/page";

/**
 * Rota que não existe.
 *
 * Sem ela o React Router não casava nada e o app renderizava uma tela
 * literalmente em branco — um link velho no histórico do navegador, ou um
 * atalho da tela inicial apontando para uma rota que mudou de nome, levava a
 * lugar nenhum sem dizer por quê.
 */
export function NaoEncontrada() {
  const navigate = useNavigate();
  return (
    <Page>
      <PageHeader title="Página não encontrada" />
      <Card>
        <EmptyState
          icon={<Compass className="size-6" />}
          title="Esta tela não existe"
          description="O endereço pode ter mudado, ou o link estar velho. As telas do app estão todas na barra de baixo."
          action={<Button onClick={() => navigate("/")}>Ir para o início</Button>}
        />
      </Card>
    </Page>
  );
}
