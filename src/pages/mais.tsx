import { Link, useNavigate } from "react-router-dom";
import {
  Apple,
  Bot,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  LogOut,
  Settings,
  Target,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { useAuth } from "@/lib/auth-context";
import { useAiConfig } from "@/hooks/use-ai-config";
import { usePlanoAtivo } from "@/hooks/use-plano";
import { ThemeToggle } from "@/lib/theme";

function ItemLista({
  to,
  icone: Icone,
  label,
  sub,
  destaque,
}: {
  to: string;
  icone: LucideIcon;
  label: string;
  sub: string;
  destaque?: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted active:bg-muted"
      >
        <span
          className={
            destaque
              ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-tint-primary text-primary"
              : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          }
        >
          <Icone className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="t-caption block truncate">{sub}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

export function Mais() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: config } = useAiConfig();
  const { data: plano } = usePlanoAtivo();

  const iaHabilitada = config && (config.aloy_enabled || config.gemini_enabled);

  function handleSair() {
    qc.clear();
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <Page>
      <PageHeader title="Mais" />

      <Card padded={false}>
        <ul className="divide-y divide-border">
          {/* O plano vem primeiro: é o que molda todas as outras telas. */}
          <ItemLista
            to="/plano"
            icone={ClipboardList}
            label="Plano alimentar"
            sub={plano ? plano.nome : "Importar planilha ou baixar o template"}
            destaque
          />
          <ItemLista
            to="/alimentos"
            icone={Apple}
            label="Alimentos"
            sub="Catálogo e alimentos próprios"
          />
          <ItemLista
            to="/refeicoes"
            icone={UtensilsCrossed}
            label="Refeições"
            sub="Nomes e horários do diário"
          />
          <ItemLista
            to="/exercicios"
            icone={Dumbbell}
            label="Exercícios"
            sub="Catálogo e exercícios próprios"
          />
          <ItemLista to="/metas" icone={Target} label="Metas" sub="Perfil e objetivo" />
        </ul>
      </Card>

      <Card padded={false}>
        <ul className="divide-y divide-border">
          {iaHabilitada && (
            <ItemLista
              to="/ia"
              icone={Bot}
              label="Assistente"
              sub={
                [config?.gemini_enabled && "Gemini", config?.aloy_enabled && "Aloy"]
                  .filter(Boolean)
                  .join(" · ") || "Configurado"
              }
            />
          )}
          <ItemLista
            to="/ajustes"
            icone={Settings}
            label="Ajustes"
            sub="Conta e integrações"
          />
        </ul>
      </Card>

      <Card padded={false}>
        <ThemeToggle />
      </Card>

      <Card padded={false}>
        <button
          type="button"
          onClick={handleSair}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-tint-danger active:bg-tint-danger"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <LogOut className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-destructive">Sair</span>
            <span className="t-caption block">Encerrar a sessão neste aparelho</span>
          </span>
        </button>
      </Card>

      <p className="t-caption pt-2 text-center">Macronaut · nutrição e treino</p>
    </Page>
  );
}
