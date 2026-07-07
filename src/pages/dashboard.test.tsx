import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { MemoryRouter } from "react-router-dom";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { Dashboard } from "./dashboard";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <MemoryRouter><Dashboard /></MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

it("sem perfil, mostra CTA para definir metas", async () => {
  renderPage();
  await waitFor(() =>
    expect(screen.getByRole("link", { name: /definir metas/i })).toBeInTheDocument(),
  );
});
