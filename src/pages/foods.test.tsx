import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { Foods } from "./foods";
import { listCustomFoods } from "../repositories/foods";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <MemoryRouter>
          <Foods />
        </MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

it("cadastra um alimento custom", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole("button", { name: /novo/i }));
  await user.type(screen.getByLabelText(/nome/i), "Pão");
  await user.type(screen.getByLabelText(/^base$/i), "50");
  await user.type(screen.getByLabelText(/kcal/i), "135");
  await user.type(screen.getByLabelText(/proteína/i), "4");
  await user.type(screen.getByLabelText(/carbo/i), "27");
  await user.type(screen.getByLabelText(/gordura/i), "1");
  await user.click(screen.getByRole("button", { name: /^salvar$/i }));
  await waitFor(async () => expect(await listCustomFoods(db)).toHaveLength(1));
});



it("excluir um alimento pede confirmação antes de apagar", async () => {
  const user = userEvent.setup();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, base_unit, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Pão caseiro', 'custom', 50, 'g', 135, 4, 27, 1, ?)`,
    args: [new Date().toISOString()],
  });
  renderPage();

  await user.click(await screen.findByRole("button", { name: /excluir pão caseiro/i }));
  expect(await listCustomFoods(db)).toHaveLength(1);

  await user.click(await screen.findByRole("button", { name: /^excluir$/i }));
  await waitFor(async () => expect(await listCustomFoods(db)).toHaveLength(0));
});
