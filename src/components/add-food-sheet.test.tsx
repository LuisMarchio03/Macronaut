import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { AddFoodSheet } from "./add-food-sheet";
import { listEntriesByDate } from "../repositories/entries";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz', 'taco', 100, 128, 2.5, 28, 0.2, ?)`,
    args: [new Date().toISOString()],
  });
});

function renderSheet() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <AddFoodSheet data="2026-07-06" mealId={null} open onClose={() => {}} />
      </DbProvider>
    </QueryClientProvider>,
  );
}

it("busca alimento, informa quantidade e registra", async () => {
  const user = userEvent.setup();
  renderSheet();
  await user.type(screen.getByPlaceholderText(/buscar/i), "arroz");
  await user.click(await screen.findByText("Arroz"));
  await user.clear(screen.getByLabelText(/quantidade/i));
  await user.type(screen.getByLabelText(/quantidade/i), "150");
  await user.click(screen.getByRole("button", { name: /adicionar/i }));

  await waitFor(async () =>
    expect(await listEntriesByDate(db, 1, "2026-07-06")).toHaveLength(1),
  );
});
