import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { BackLink, Page, PageHeader } from "../components/ui/page";
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
    <Page>
      <PageHeader eyebrow={<BackLink to="/mais">Mais</BackLink>} title="Ajustes" />

      {config?.gemini_enabled && (
        <Card header="Chave do Gemini">
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
            <Button type="submit" block disabled={!key.trim()}>
              Salvar chave
            </Button>
          </form>
          {salvo && <p className="text-[0.8125rem] font-medium text-success">Chave salva.</p>}
          {erro && <p className="text-[0.8125rem] font-medium text-destructive">{erro}</p>}
        </Card>
      )}

      <Card>
        <Button variant="destructive-ghost" block onClick={logout}>
          Sair da conta
        </Button>
      </Card>
    </Page>
  );
}