import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import type { ReactNode } from "react";
import { DbProvider } from "../../src/lib/db-context";

/**
 * Wrapper de teste para hooks/componentes que falam com o banco.
 * `retry: false` porque num teste um erro deve falhar na hora, não depois de
 * 3 tentativas silenciosas. QueryClient novo por wrapper: sem cache vazando
 * entre testes.
 */
export function criarWrapper(db: Client) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
      <QueryClientProvider client={qc}>
        <DbProvider client={db}>{children}</DbProvider>
      </QueryClientProvider>
    );
  };
}
