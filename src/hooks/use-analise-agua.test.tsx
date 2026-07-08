import { it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { addWater } from "../repositories/water";
import { useAnaliseAgua } from "./use-analise-agua";

it("agrega ml por dia no range", async () => {
  const db = await createTestDb();
  await addWater(db, 1, "2026-07-06", 400);
  await addWater(db, 1, "2026-07-06", 100);
  await addWater(db, 1, "2026-07-20", 900);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><DbProvider client={db}>{children}</DbProvider></QueryClientProvider>
  );
  const { result } = renderHook(() => useAnaliseAgua("2026-07-06", "2026-07-12"), { wrapper });
  await waitFor(() => expect(result.current.data).toBeTruthy());
  expect(result.current.data!.get("2026-07-06")).toBe(500);
  expect(result.current.data!.has("2026-07-20")).toBe(false);
});
