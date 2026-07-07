import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { DbProvider } from "../../lib/db-context";
import { TreinoTab } from "./treino-tab";
import { getSessionByDate, listSetsBySession } from "../../repositories/workouts";
import { hoje } from "../../lib/date";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({ sql: "INSERT INTO exercises (nome, created_at) VALUES ('Supino', ?)", args: [new Date().toISOString()] });
});

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><TreinoTab /></DbProvider>
    </QueryClientProvider>,
  );
}

it("inicia treino do dia e loga uma série", async () => {
  const user = userEvent.setup();
  renderTab();
  await user.click(await screen.findByRole("button", { name: /iniciar treino/i }));
  await waitFor(async () => expect(await getSessionByDate(db, hoje())).not.toBeNull());

  // escolher exercício, reps e peso, adicionar série
  await user.selectOptions(await screen.findByLabelText(/exerc/i), "Supino");
  await user.clear(screen.getByLabelText(/reps/i));
  await user.type(screen.getByLabelText(/reps/i), "10");
  await user.clear(screen.getByLabelText(/peso/i));
  await user.type(screen.getByLabelText(/peso/i), "80");
  await user.click(screen.getByRole("button", { name: /\+ s[ée]rie/i }));

  await waitFor(async () => {
    const s = await getSessionByDate(db, hoje());
    expect(await listSetsBySession(db, s!.id)).toHaveLength(1);
  });
});
