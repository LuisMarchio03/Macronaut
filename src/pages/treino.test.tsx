import { it, expect, describe } from "vitest";
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
        <MemoryRouter>
          <DataProvider>
            <Treino />
          </DataProvider>
        </MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

describe("abas de treino", () => {
  it("expõe as duas visões como abas, não como botões soltos", async () => {
    // `role="tab"` + `aria-selected` dizem ao leitor de tela quantas visões
    // existem e qual está aberta; um grupo de <button> não diz nenhuma coisa
    // nem a outra.
    await renderPage();
    const abas = screen.getAllByRole("tab");
    expect(abas.map((a) => a.textContent)).toEqual(["Treino", "Progressão"]);
    expect(abas[0]).toHaveAttribute("aria-selected", "true");
    expect(abas[1]).toHaveAttribute("aria-selected", "false");
  });

  it("troca para Progressão", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("tab", { name: "Progressão" }));

    expect(screen.getByRole("tab", { name: "Progressão" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Treino" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Biblioteca de exercícios")).toBeInTheDocument();
  });

  it("mostra o cardio junto do treino, e só ali", async () => {
    const user = userEvent.setup();
    await renderPage();
    expect(screen.getByText("Cardio")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Progressão" }));
    expect(screen.queryByText("Cardio")).toBeNull();
  });
});
