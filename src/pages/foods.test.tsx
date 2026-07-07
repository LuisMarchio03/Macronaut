import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
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
      <DbProvider client={db}><Foods /></DbProvider>
    </QueryClientProvider>,
  );
}

it("cadastra um alimento custom", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole("button", { name: /novo alimento/i }));
  await user.type(screen.getByLabelText(/nome/i), "Pão");
  await user.type(screen.getByLabelText(/base.*g/i), "50");
  await user.type(screen.getByLabelText(/kcal/i), "135");
  await user.type(screen.getByLabelText(/proteína/i), "4");
  await user.type(screen.getByLabelText(/carbo/i), "27");
  await user.type(screen.getByLabelText(/gordura/i), "1");
  await user.click(screen.getByRole("button", { name: /salvar/i }));
  await waitFor(async () => expect(await listCustomFoods(db)).toHaveLength(1));
});
