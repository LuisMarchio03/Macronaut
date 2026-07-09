import { it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { setAiFlags } from "../repositories/ai";
import { DbProvider } from "../lib/db-context";
import { useAiConfig } from "./use-ai-config";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({ sql: "INSERT INTO users (email,password_hash,created_at) VALUES ('a@x.com','h','2026-07-09')", args: [] });
  await setAiFlags(db, "a@x.com", { gemini_enabled: true });
});

function wrap(children: React.ReactNode) {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <DbProvider client={db} userId={1}>{children}</DbProvider>
    </QueryClientProvider>
  );
}

it("lê as flags do usuário", async () => {
  const { result } = renderHook(() => useAiConfig(), { wrapper: ({ children }) => wrap(children) });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data).toMatchObject({ gemini_enabled: true, aloy_enabled: false });
});
