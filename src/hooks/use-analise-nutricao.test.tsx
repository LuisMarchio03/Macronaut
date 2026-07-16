import { it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { createEntry } from "../repositories/entries";
import { useAnaliseNutricao } from "./use-analise-nutricao";

it("busca os entries do range e o mapa de foods", async () => {
  const db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz', 'taco', 100, 100, 2, 20, 1, ?)`,
    args: [new Date().toISOString()],
  });
  await createEntry(db, 1, { data: "2026-07-06", meal_id: null, food_id: 1, qty_g: 100, measure_id: null, measure_count: null, label: null });
  await createEntry(db, 1, { data: "2026-07-20", meal_id: null, food_id: 1, qty_g: 100, measure_id: null, measure_count: null, label: null });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><DbProvider client={db}>{children}</DbProvider></QueryClientProvider>
  );
  const { result } = renderHook(() => useAnaliseNutricao("2026-07-06", "2026-07-12"), { wrapper });

  await waitFor(() => expect(result.current.data).toBeTruthy());
  expect(result.current.data!.entries).toHaveLength(1);
  expect(result.current.data!.foodsById.get(1)?.nome).toBe("Arroz");
});
