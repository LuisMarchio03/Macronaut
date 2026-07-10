import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { DbProvider } from "../../lib/db-context";
import { DataProvider } from "../../lib/data-context";
import { TreinoTab } from "./treino-tab";
import { getSessionByDate, listSetsBySession, createSession, addSet } from "../../repositories/workouts";
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
      <DbProvider client={db}><DataProvider><TreinoTab /></DataProvider></DbProvider>
    </QueryClientProvider>,
  );
}

it("inicia treino do dia e loga uma série", async () => {
  const user = userEvent.setup();
  renderTab();
  await user.click(await screen.findByRole("button", { name: /iniciar treino/i }));
  await waitFor(async () => expect(await getSessionByDate(db, 1, hoje())).not.toBeNull());

  // escolher exercício, reps e peso, adicionar série
  await user.selectOptions(await screen.findByLabelText(/exerc/i), "Supino");
  await user.clear(screen.getByLabelText(/reps/i));
  await user.type(screen.getByLabelText(/reps/i), "10");
  await user.clear(screen.getByLabelText(/peso/i));
  await user.type(screen.getByLabelText(/peso/i), "80");
  await user.click(screen.getByRole("button", { name: /\+ s[ée]rie/i }));

  await waitFor(async () => {
    const s = await getSessionByDate(db, 1, hoje());
    expect(await listSetsBySession(db, 1, s!.id)).toHaveLength(1);
  });
});

it("editar série inline altera reps/peso e persiste", async () => {
  const user = userEvent.setup();
  const s = await createSession(db, 1, { data: hoje(), nome: null });
  await addSet(db, 1, { session_id: s.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40 });
  renderTab();

  await user.click(await screen.findByText(/10 reps × 40 kg/i));
  // match exato: evita colidir com o Label "Reps"/"Peso (kg)" do formulário "Nova série"
  const reps = screen.getByLabelText("reps");
  await user.clear(reps);
  await user.type(reps, "8");
  const peso = screen.getByLabelText("peso");
  await user.clear(peso);
  await user.type(peso, "50");
  await user.click(screen.getByRole("button", { name: /confirmar/i }));

  await waitFor(() => expect(screen.getByText(/8 reps × 50 kg/i)).toBeInTheDocument());

  const sets = await listSetsBySession(db, 1, s.id);
  expect(sets).toHaveLength(1);
  expect(sets[0]).toMatchObject({ reps: 8, peso_kg: 50 });
});
