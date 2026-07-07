import { createContext, useContext, type ReactNode } from "react";
import type { Client } from "@libsql/client/web";

const DbContext = createContext<Client | null>(null);

export function DbProvider({ client, children }: { client: Client; children: ReactNode }) {
  return <DbContext.Provider value={client}>{children}</DbContext.Provider>;
}

export function useDb(): Client {
  const db = useContext(DbContext);
  if (!db) throw new Error("useDb precisa estar dentro de <DbProvider>");
  return db;
}
