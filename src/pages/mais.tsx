import { Link, useNavigate } from "react-router-dom";
import {
  Apple, UtensilsCrossed, Target, Bot, Settings, LogOut,
  ChevronRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "@/components/ui/section-card";
import { useAuth } from "@/lib/auth-context";
import { useAiConfig } from "@/hooks/use-ai-config";
import { ThemeToggle } from "@/lib/theme";
import { cn } from "@/lib/utils";

const links = [
  { to: "/alimentos", label: "Alimentos", sub: "Catálogo de alimentos", icon: Apple },
  { to: "/refeicoes", label: "Refeições", sub: "Agenda de horários", icon: UtensilsCrossed },
  { to: "/metas", label: "Metas", sub: "Perfil e objetivos", icon: Target },
] as const;

export function Mais() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: config } = useAiConfig();

  const iaHabilitada = config && (config.aloy_enabled || config.gemini_enabled);

  function handleSair() {
    qc.clear();
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="space-y-5 p-4">
      <header className="space-y-1 pt-2">
        <p className="section-title">Central</p>
        <h1 className="text-2xl font-semibold tracking-tight">Mais</h1>
      </header>

      <SectionCard variant="elevated" bodyClassName="p-1">
        <ul className="divide-y divide-border/40">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{l.label}</span>
                    <span className="block text-xs text-muted-foreground">{l.sub}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                </Link>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard variant="elevated" bodyClassName="p-1">
        <ul className="divide-y divide-border/40">
          {iaHabilitada && (
            <li>
              <Link
                to="/ia"
                className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bot className="size-5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Assistente IA</span>
                  <span className="block text-xs text-muted-foreground">
                    Gemini{config?.aloy_enabled ? " · Aloy" : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
              </Link>
            </li>
          )}
          <li>
            <Link
              to="/ajustes"
              className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Settings className="size-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Ajustes</span>
                <span className="block text-xs text-muted-foreground">Configurações da conta</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            </Link>
          </li>
        </ul>
      </SectionCard>

      <SectionCard variant="outlined" bodyClassName="p-1">
        <ThemeToggle />
      </SectionCard>

      <SectionCard variant="elevated" bodyClassName="p-1">
        <button
          type="button"
          onClick={handleSair}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-3 transition-colors",
            "text-destructive hover:bg-destructive/10",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <LogOut className="size-5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-medium">Sair</span>
            <span className="block text-xs text-muted-foreground">Encerrar sessão</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
        </button>
      </SectionCard>

      <p className="pb-4 text-center font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground/50">
        Macronaut · nutrição & treino
      </p>
    </div>
  );
}