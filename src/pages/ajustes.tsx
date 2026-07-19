import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { SectionCard } from "../components/ui/section-card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth-context";
import { useDb, useUserId } from "../lib/db-context";
import { useAiConfig } from "../hooks/use-ai-config";
import { setGeminiKey } from "../repositories/ai";

export function Ajustes() {
  const { logout } = useAuth();
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  const { data: config } = useAiConfig();
  const [key, setKey] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");

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
      <header className="space-y-1 pt-2">
        <Link
          to="/mais"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" /> Voltar
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      </header>

      {config?.gemini_enabled && (
        <SectionCard variant="elevated" header="Chave do Gemini" bodyClassName="space-y-2">
          <form
            className="space-y-2"
            onSubmit={(e) => { e.preventDefault(); void salvarKey(); }}
          >
            <Label htmlFor="gemini-key">API Key</Label>
            <Input
              id="gemini-key"
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setSalvo(false); setErro(""); }}
              placeholder={config.has_gemini_key ? "•••••••• (configurada)" : "cole sua API key"}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={!key.trim()}>Salvar chave</Button>
              <Button type="button" variant="ghost" className="ml-auto text-muted-foreground hover:text-destructive" onClick={logout}>
                Sair
              </Button>
            </div>
          </form>
          {salvo && <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-emerald-400">Chave salva.</p>}
          {erro && <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-destructive">{erro}</p>}
        </SectionCard>
      )}

      {!config?.gemini_enabled && (
        <div className="flex justify-center pt-8">
          <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={logout}>
            Sair
          </Button>
        </div>
      )}
    </div>
  );
}