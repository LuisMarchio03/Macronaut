import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { MemoryRouter } from "react-router-dom";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { DataProvider } from "../lib/data-context";
import { Treino } from "./treino";

async function renderPage() {
  const db: Client = await createTestDb();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <MemoryRouter><DataProvider><Treino /></DataProvider></MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

it("mostra as 4 abas e troca para Exercícios", async () => {
  const user = userEvent.setup();
  await renderPage();
  expect(screen.getByRole("tab", { name: /treino/i })).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: /exerc/i }));
  expect(screen.getByRole("tab", { name: /exerc/i })).toHaveAttribute("aria-selected", "true");
});
