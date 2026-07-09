import { it, expect, beforeEach } from "vitest";
import { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { insertMessage } from "../repositories/ai";
import { DbProvider } from "../lib/db-context";
import { useAiConversation } from "./use-ai-messages";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({ sql: "INSERT INTO users (email,password_hash,created_at) VALUES ('a@x.com','h','2026-07-09')", args: [] });
});

function wrap(children: ReactNode) {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <DbProvider client={db} userId={1}>{children}</DbProvider>
    </QueryClientProvider>
  );
}

it("carrega a conversa mais recente do provider, em ordem cronológica", async () => {
  await insertMessage(db, { user_id: 1, provider: "gemini", session_id: "s1", role: "user", content: "antiga" });
  await insertMessage(db, { user_id: 1, provider: "gemini", session_id: "s2", role: "user", content: "oi" });
  await insertMessage(db, { user_id: 1, provider: "gemini", session_id: "s2", role: "assistant", content: "olá" });
  const { result } = renderHook(() => useAiConversation("gemini"), { wrapper: ({ children }) => wrap(children) });
  await waitFor(() => expect(result.current.isFetched).toBe(true));
  expect(result.current.data?.sessionId).toBe("s2");
  expect(result.current.data?.messages).toEqual([
    { role: "user", content: "oi" },
    { role: "assistant", content: "olá" },
  ]);
});

it("retorna null sem histórico", async () => {
  const { result } = renderHook(() => useAiConversation("aloy"), { wrapper: ({ children }) => wrap(children) });
  await waitFor(() => expect(result.current.isFetched).toBe(true));
  expect(result.current.data).toBeNull();
});
