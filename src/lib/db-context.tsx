import { createContext, useContext, type ReactNode } from "react";
import type { Api } from "./api";

/**
 * Quem o app tem para falar com os dados: a `Api`, e mais nada.
 *
 * Houve um `db` aqui — um cliente que mandava SQL para `/api/db`. Ele foi
 * embora junto com a rota: enquanto existisse, uma sessão válida podia rodar
 * qualquer consulta, inclusive nas linhas de outro usuário. Agora o cliente
 * manda o NOME de uma operação, e o `user_id` vem do token no servidor.
 */
type DbCtx = { userId: number; api: Api };

const DbContext = createContext<DbCtx | null>(null);

// userId default = 1 apenas para ergonomia de testes de componente/hook
// (um único usuário). Em produção, RequireAuth SEMPRE passa o id da sessão.
export function DbProvider({
  api,
  userId = 1,
  children,
}: {
  api: Api;
  userId?: number;
  children: ReactNode;
}) {
  return <DbContext.Provider value={{ userId, api }}>{children}</DbContext.Provider>;
}

export function useApi(): Api {
  const c = useContext(DbContext);
  if (!c) throw new Error("useApi precisa estar dentro de <DbProvider>");
  return c.api;
}

export function useUserId(): number {
  const c = useContext(DbContext);
  if (!c) throw new Error("useUserId precisa estar dentro de <DbProvider>");
  return c.userId;
}
