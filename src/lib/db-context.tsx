import { createContext, useContext, type ReactNode } from "react";
import type { Client } from "@libsql/client/web";

type DbCtx = { db: Client; userId: number };
const DbContext = createContext<DbCtx | null>(null);

// userId default = 1 apenas para ergonomia de testes de componente/hook
// (um único usuário). Em produção, RequireAuth SEMPRE passa o id da sessão.
export function DbProvider({
  client,
  userId = 1,
  children,
}: {
  client: Client;
  userId?: number;
  children: ReactNode;
}) {
  return <DbContext.Provider value={{ db: client, userId }}>{children}</DbContext.Provider>;
}

export function useDb(): Client {
  const c = useContext(DbContext);
  if (!c) throw new Error("useDb precisa estar dentro de <DbProvider>");
  return c.db;
}

export function useUserId(): number {
  const c = useContext(DbContext);
  if (!c) throw new Error("useUserId precisa estar dentro de <DbProvider>");
  return c.userId;
}
