import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { insertMessage } from "../../repositories/ai";
import * as aiRepo from "../../repositories/ai";
import { DbProvider } from "../../lib/db-context";
import { AuthProvider } from "../../lib/auth-context";
import { ChatView } from "./chat-view";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({ sql: "INSERT INTO users (email,password_hash,created_at) VALUES ('a@x.com','h','2026-07-09')", args: [] });
});

function tela() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <DbProvider client={db} userId={1}>
          <ChatView config={{ aloy_enabled: false, gemini_enabled: true, has_gemini_key: true }} />
        </DbProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

it("restaura o histórico persistido ao montar", async () => {
  await insertMessage(db, { user_id: 1, provider: "gemini", session_id: "s1", role: "user", content: "pergunta antiga" });
  await insertMessage(db, { user_id: 1, provider: "gemini", session_id: "s1", role: "assistant", content: "resposta antiga" });
  tela();
  expect(await screen.findByText("pergunta antiga")).toBeInTheDocument();
  expect(screen.getByText("resposta antiga")).toBeInTheDocument();
});

it("bloqueia o envio enquanto o histórico inicial ainda carrega", async () => {
  let resolver: (v: string | null) => void = () => {};
  vi.spyOn(aiRepo, "getLatestSessionId").mockReturnValue(
    new Promise<string | null>((r) => { resolver = r; }),
  );
  tela();
  const input = screen.getByPlaceholderText(/pergunte/i);
  expect(input).toBeDisabled();          // enquanto o histórico não resolve
  resolver(null);                         // fetch inicial resolve (sem histórico)
  await waitFor(() => expect(screen.getByPlaceholderText(/pergunte/i)).not.toBeDisabled());
  vi.restoreAllMocks();
});
