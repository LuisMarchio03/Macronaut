import { createContext, useContext, type ReactNode } from "react";
import type { Client } from "@libsql/client/web";
import type { Api } from "./api";

/**
 * `db` e `api` convivem enquanto a migração acontece.
 *
 * `db` é `/api/db`, que aceita SQL — o caminho de todos os repositórios que
 * ainda não têm operação registrada. `api` é `/api/rpc`, onde o `user_id` vem
 * do token. Módulo migrado usa `api`; o resto continua no `db`.
 */
type DbCtx = { db: Client; userId: number; api: Api | null };
const DbContext = createContext<DbCtx | null>(null);

// userId default = 1 apenas para ergonomia de testes de componente/hook
// (um único usuário). Em produção, RequireAuth SEMPRE passa o id da sessão.
export function DbProvider({
  client,
  // Opcional porque meia dúzia de testes monta este provedor à mão e não toca
  // em nada migrado. `useApi` falha com uma frase se alguém precisar dela e
  // ela não estiver ali — em vez de um `undefined` que só aparece na tela.
  api = null,
  userId = 1,
  children,
}: {
  client: Client;
  api?: Api | null;
  userId?: number;
  children: ReactNode;
}) {
  return (
    <DbContext.Provider value={{ db: client, userId, api }}>{children}</DbContext.Provider>
  );
}

export function useDb(): Client {
  const c = useContext(DbContext);
  if (!c) throw new Error("useDb precisa estar dentro de <DbProvider>");
  return c.db;
}

export function useApi(): Api {
  const c = useContext(DbContext);
  if (!c) throw new Error("useApi precisa estar dentro de <DbProvider>");
  if (!c.api) {
    throw new Error(
      "este <DbProvider> foi montado sem `api`. Em teste, use `criarWrapper(db)`, " +
        "que fornece a mesma implementação que o servidor usa.",
    );
  }
  return c.api;
}

export function useUserId(): number {
  const c = useContext(DbContext);
  if (!c) throw new Error("useUserId precisa estar dentro de <DbProvider>");
  return c.userId;
}
