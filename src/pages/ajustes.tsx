import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/lib/theme";
import { Card } from "../components/ui/card";
import { BackLink, Page, PageHeader } from "../components/ui/page";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth-context";
import { useDb, useUserId } from "../lib/db-context";
import { useAiConfig } from "../hooks/use-ai-config";
import { setGeminiKey } from "../repositories/ai";

/** Esconde o meio do host: `libsql://macronaut-org.turso.io` → `libsql://mac…io`. */
function resumirUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

export function Ajustes() {
  const { logout, session } = useAuth();
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

      {/* Saber a QUAL banco o app está falando não é curiosidade: sem isso,
          "não funcionou" e "está apontando pro banco errado" são
          indistinguíveis da tela. */}
      <Card header="Conta e dados" padded={false}>
        <dl className="divide-y divide-border">
          <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <dt className="t-caption shrink-0">Conta</dt>
            <dd className="min-w-0 truncate text-sm font-medium">
              {session?.email ?? "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <dt className="t-caption shrink-0">Banco de dados</dt>
            <dd className="min-w-0 truncate text-sm font-medium" title={session?.dbUrl}>
              {session ? resumirUrl(session.dbUrl) : "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <dt className="t-caption shrink-0">Assistente de IA</dt>
            <dd className="text-sm font-medium">
              {config?.gemini_enabled || config?.aloy_enabled
                ? [config?.gemini_enabled && "Gemini", config?.aloy_enabled && "Aloy"]
                    .filter(Boolean)
                    .join(" · ")
                : "Desligado"}
            </dd>
          </div>
        </dl>
      </Card>

      {/* O tema era uma funcionalidade anunciada e inalcançável: `ThemeToggle`
          existia em lib/theme.tsx sem estar montado em tela nenhuma. */}
      <Card header="Aparência" padded={false}>
        <ThemeToggle />
      </Card>

      {!config?.gemini_enabled && !config?.aloy_enabled && (
        <Card>
          <p className="t-caption">
            O assistente é ligado por fora do app, com{" "}
            <span className="font-mono text-[0.75rem]">npm run ai:flags</span>. Depois de
            ligar, a chave do Gemini se cadastra aqui.
          </p>
        </Card>
      )}

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