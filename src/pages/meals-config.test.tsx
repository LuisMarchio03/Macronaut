import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { MealsConfig } from "./meals-config";
import { listMeals } from "../repositories/meals";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><MealsConfig /></DbProvider>
    </QueryClientProvider>,
  );
}

describe("MealsConfig", () => {
  it("adiciona uma refeição", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /adicionar refeição/i }));
    await user.type(screen.getByLabelText(/nome da refeição/i), "Pré-treino");
    await user.click(screen.getByRole("button", { name: /^salvar$/i }));
    await waitFor(async () =>
      expect((await listMeals(db)).some((m) => m.nome === "Pré-treino")).toBe(true),
    );
  });
});
