import { it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import type { ReactNode } from "react";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { useTodayEntries, useAddEntry } from "./use-today-entries";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz', 'taco', 100, 128, 2.5, 28, 0.2, ?)`,
    args: [new Date().toISOString()],
  });
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>{children}</DbProvider>
    </QueryClientProvider>
  );
}

it("lista entries do dia e adiciona um novo", async () => {
  const { result } = renderHook(
    () => ({ lista: useTodayEntries("2026-07-06"), add: useAddEntry() }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
  expect(result.current.lista.data).toHaveLength(0);

  await result.current.add.mutateAsync({
    data: "2026-07-06", meal_id: null, food_id: 1, qty_g: 100, label: null,
  });
  await waitFor(() => expect(result.current.lista.data).toHaveLength(1));
});
