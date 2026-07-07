import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { DbProvider } from "../../lib/db-context";
import { ExerciciosTab } from "./exercicios-tab";
import { listExercises } from "../../repositories/exercises";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><ExerciciosTab /></DbProvider>
    </QueryClientProvider>,
  );
}

it("cadastra um exercício", async () => {
  const user = userEvent.setup();
  renderTab();
  await user.click(await screen.findByRole("button", { name: /novo exerc/i }));
  await user.type(screen.getByLabelText(/nome/i), "Supino");
  await user.click(screen.getByRole("button", { name: /^salvar$/i }));
  await waitFor(async () => expect(await listExercises(db)).toHaveLength(1));
});
