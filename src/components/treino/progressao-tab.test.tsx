import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { DbProvider } from "../../lib/db-context";
import { ProgressaoTab } from "./progressao-tab";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  const now = new Date().toISOString();
  await db.execute({ sql: "INSERT INTO exercises (nome, created_at) VALUES ('Supino', ?)", args: [now] });
  await db.execute({ sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (1, '2026-06-30', ?)", args: [now] });
  await db.execute({ sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (1, '2026-07-06', ?)", args: [now] });
  await db.execute({ sql: "INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at) VALUES (1,1,1,1,10,75,?)", args: [now] });
  await db.execute({ sql: "INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at) VALUES (1,2,1,1,10,80,?)", args: [now] });
});

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><ProgressaoTab /></DbProvider>
    </QueryClientProvider>,
  );
}

it("escolhe exercício e mostra o gráfico", async () => {
  const user = userEvent.setup();
  const { container } = renderTab();
  await screen.findByRole("option", { name: "Supino" });
  await user.selectOptions(await screen.findByLabelText(/exerc/i), "Supino");
  await waitFor(() => expect(container.querySelector("polyline")).toBeInTheDocument());
});
