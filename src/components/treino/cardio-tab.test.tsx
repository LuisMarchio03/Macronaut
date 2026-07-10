import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { DbProvider } from "../../lib/db-context";
import { DataProvider } from "../../lib/data-context";
import { CardioTab } from "./cardio-tab";
import { seedActivityTypes, listActivitySessions } from "../../repositories/activities";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await seedActivityTypes(db);
});

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DataProvider>
        <DbProvider client={db}><CardioTab /></DbProvider>
      </DataProvider>
    </QueryClientProvider>,
  );
}

it("registra uma atividade com kcal manual", async () => {
  const user = userEvent.setup();
  renderTab();
  // Espera as opções (carregadas de forma assíncrona via useActivityTypes)
  // estarem populadas antes de selecionar — o <select>/label já existe no
  // primeiro render, mas as <option>s só chegam depois que a query resolve.
  await screen.findByRole("option", { name: "Corrida" });
  await user.selectOptions(screen.getByLabelText(/atividade/i), "Corrida");
  await user.clear(screen.getByLabelText(/dura/i));
  await user.type(screen.getByLabelText(/dura/i), "30");
  await user.clear(screen.getByLabelText(/kcal/i));
  await user.type(screen.getByLabelText(/kcal/i), "340");
  await user.click(screen.getByRole("button", { name: /salvar/i }));
  await waitFor(async () => expect(await listActivitySessions(db, 1)).toHaveLength(1));
});

it("desabilita o botão Salvar quando kcal está vazio", async () => {
  const user = userEvent.setup();
  renderTab();
  // Aguarda as opções serem carregadas (async)
  await screen.findByRole("option", { name: "Corrida" });
  await user.selectOptions(screen.getByLabelText(/atividade/i), "Corrida");
  await user.clear(screen.getByLabelText(/dura/i));
  await user.type(screen.getByLabelText(/dura/i), "30");
  // kcal fica vazio
  expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
});
