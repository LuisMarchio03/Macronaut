import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { HudPanel } from "../components/ui/hud-panel";
import { useAuth } from "../lib/auth-context";

export function Login() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await login(email, senha);
      navigate("/", { replace: true });
    } catch {
      setErro("E-mail ou senha inválidos.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-1">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-primary/70">
          Macronaut · acesso
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
      </header>

      <HudPanel label="Credenciais" bodyClassName="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" type="password" autoComplete="current-password" value={senha}
              onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" className="w-full" disabled={!email || !senha || carregando}>
            {carregando ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </HudPanel>
    </div>
  );
}
