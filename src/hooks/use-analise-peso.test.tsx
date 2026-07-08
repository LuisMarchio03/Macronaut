import { it, expect } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { upsertWeighIn, getWeighInsByRange } from "../repositories/weighins";
import { hoje } from "../lib/date";
import { useAnalisePeso, useRegistrarPeso } from "./use-analise-peso";

function makeWrapper(db: Awaited<ReturnType<typeof createTestDb>>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><DbProvider client={db}>{children}</DbProvider></QueryClientProvider>
  );
}

it("useRegistrarPeso grava a pesagem de hoje", async () => {
  const db = await createTestDb();
  const { result } = renderHook(() => useRegistrarPeso(), { wrapper: makeWrapper(db) });
  await act(async () => { await result.current.mutateAsync(80); });
  expect(await getWeighInsByRange(db, 1, hoje(), hoje())).toEqual([{ data: hoje(), peso_kg: 80 }]);
});

it("useAnalisePeso lê o range", async () => {
  const db = await createTestDb();
  await upsertWeighIn(db, 1, "2026-07-06", 80);
  const { result } = renderHook(() => useAnalisePeso("2026-07-06", "2026-07-12"), { wrapper: makeWrapper(db) });
  await waitFor(() => expect(result.current.data).toBeTruthy());
  expect(result.current.data).toEqual([{ data: "2026-07-06", peso_kg: 80 }]);
});
