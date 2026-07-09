import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Apple, UtensilsCrossed, Target, Bot, ChevronRight, type LucideIcon,
} from "lucide-react";
import { HudPanel } from "../components/ui/hud-panel";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth-context";
import { useDb, useUserId } from "../lib/db-context";
import { useAiConfig } from "../hooks/use-ai-config";
import { setGeminiKey } from "../repositories/ai";

const cards: { to: string; label: string; sub: string; icon: LucideIcon }[] = [
  { to: "/alimentos", label: "Alimentos", sub: "catálogo de alimentos", icon: Apple },
  { to: "/refeicoes", label: "Refeições", sub: "agenda de horários", icon: UtensilsCrossed },
  { to: "/metas", label: "Metas", sub: "perfil & metas", icon: Target },
];

export function Ajustes() {
  const { logout } = useAuth();
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  const { data: config } = useAiConfig();
  const [key, setKey] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

  const iaHabilitada = !!config && (config.aloy_enabled || config.gemini_enabled);
  const provedoresIa = config
    ? (["gemini", "aloy"] as const).filter((p) => config[`${p}_enabled`])
    : [];

  const salvarKey = async () => {
    if (!key.trim()) return;
    setErro("");
    try {
      await setGeminiKey(db, userId, key.trim());
      await qc.invalidateQueries({ queryKey: ["ai-config"] });
      setKey("");
      setSalvo(true);
    } catch {
      setSalvo(false);
      setErro("Não foi possível salvar a chave. Tente novamente.");
    }
  };

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-1">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-primary/70">Central · ajustes</p>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      </header>

      <HudPanel label="Configuração" bodyClassName="p-2">
        <ul className="divide-y divide-border/40">
          {[
            ...cards,
            ...(iaHabilitada
              ? [{ to: "/ia", label: "Assistente IA", sub: provedoresIa.join(" · "), icon: Bot }]
              : []),
          ].map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.to}>
                <Link
                  to={c.to}
                  className="group flex items-center gap-3 px-2 py-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/60 bg-card/50 text-primary transition-transform group-active:scale-90">
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{c.label}</span>
                    <span className="block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">{c.sub}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 opacity-60" />
                </Link>
              </li>
            );
          })}
        </ul>
      </HudPanel>

      {config?.gemini_enabled && (
        <HudPanel label="Chave do Gemini" bodyClassName="space-y-2 p-4">
          <form
            className="space-y-2"
            onSubmit={(e) => { e.preventDefault(); void salvarKey(); }}
          >
            <Label htmlFor="gemini-key">Chave do Gemini</Label>
            <Input
              id="gemini-key"
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setSalvo(false); setErro(""); }}
              placeholder={config.has_gemini_key ? "•••••••• (configurada)" : "cole sua API key"}
            />
            <Button type="submit" disabled={!key.trim()}>Salvar chave</Button>
          </form>
          {salvo && <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-emerald-400">Chave salva.</p>}
          {erro && <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-destructive">{erro}</p>}
        </HudPanel>
      )}

      <Button type="button" variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={logout}>
        Sair
      </Button>
    </div>
  );
}
