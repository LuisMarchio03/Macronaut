import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { setAiFlags } from "../repositories/ai";
import { DbProvider } from "../lib/db-context";
import { AuthProvider } from "../lib/auth-context";
import { Ia } from "./ia";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({ sql: "INSERT INTO users (email,password_hash,created_at) VALUES ('a@x.com','h','2026-07-09')", args: [] });
  await setAiFlags(db, "a@x.com", { aloy_enabled: true });
});

it("renderiza o console quando há provedor habilitado", async () => {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <DbProvider client={db} userId={1}>
          <MemoryRouter><Ia /></MemoryRouter>
        </DbProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText("Assistente")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /aloy/i })).toBeInTheDocument();
});
