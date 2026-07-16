import { it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { createSession, addSet } from "../repositories/workouts";
import { useAnaliseTreino } from "./use-analise-treino";

it("busca sessões e sets do range", async () => {
  const db = await createTestDb();
  await db.execute("INSERT INTO exercises (nome, grupo_muscular, created_at) VALUES ('Supino', 'peito', 't')");
  const s = await createSession(db, 1, { data: "2026-07-06", nome: "A" });
  await addSet(db, 1, { session_id: s.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><DbProvider client={db}>{children}</DbProvider></QueryClientProvider>
  );
  const { result } = renderHook(() => useAnaliseTreino("2026-07-06", "2026-07-12"), { wrapper });
  await waitFor(() => expect(result.current.data).toBeTruthy());
  expect(result.current.data!.nSessoes).toBe(1);
  expect(result.current.data!.sets).toEqual([
    { data: "2026-07-06", reps: 10, peso_kg: 40, grupo: null, tipo: "valida", rir: null },
  ]);
});
