import { it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import type { ReactNode } from "react";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { useCreateSession, useSessionByDate } from "./use-workouts";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>{children}</DbProvider>
    </QueryClientProvider>
  );
}

it("cria a sessão do dia e a query reflete", async () => {
  const { result } = renderHook(
    () => ({ criar: useCreateSession(), hoje: useSessionByDate("2026-07-06") }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.hoje.isSuccess).toBe(true));
  expect(result.current.hoje.data).toBeNull();
  await result.current.criar.mutateAsync({ data: "2026-07-06", nome: "Treino A" });
  await waitFor(() => expect(result.current.hoje.data?.nome).toBe("Treino A"));
});
