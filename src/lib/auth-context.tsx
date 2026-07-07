import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadSession, saveSession, clearSession, type Session } from "./session";
import { setUnauthorizedHandler, queryClient } from "./query-client";

type AuthValue = {
  session: Session | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

async function postLogin(email: string, senha: string): Promise<Session> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  const b = (await res.json()) as {
    user: { email: string }; dbUrl: string; token: string; exp: number;
  };
  return { email: b.user.email, dbUrl: b.dbUrl, token: b.token, exp: b.exp };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const logout = () => {
    clearSession();
    setSession(null);
    // Descarta o cache do TanStack Query (keys estáticas, singleton acima do
    // AuthProvider) para não vazar dados do usuário anterior numa troca de conta.
    queryClient.clear();
  };

  useEffect(() => { setUnauthorizedHandler(logout); }, []);

  const login = async (email: string, senha: string) => {
    const s = await postLogin(email, senha);
    // Limpa qualquer resíduo de uma sessão anterior antes de entrar como o novo usuário.
    queryClient.clear();
    saveSession(s);
    setSession(s);
  };

  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return v;
}
