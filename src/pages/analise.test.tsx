import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { createEntry } from "../repositories/entries";
import { addWater } from "../repositories/water";
import { createActivitySession } from "../repositories/activities";
import { createSession, addSet } from "../repositories/workouts";
import { upsertWeighIn } from "../repositories/weighins";
import { seedMuscleGroups } from "../repositories/muscle-groups";
import { hoje } from "../lib/date";
import { Analise } from "./analise";

it("mostra o total de kcal do dia registrado no período atual", async () => {
  const db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz', 'taco', 100, 128, 2.5, 28, 0.2, ?)`,
    args: [new Date().toISOString()],
  });
  await createEntry(db, 1, { data: hoje(), meal_id: null, food_id: 1, qty_g: 100, measure_id: null, measure_count: null, label: null });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><Analise /></DbProvider>
    </QueryClientProvider>,
  );

  expect(await screen.findByText(/128 kcal · P/)).toBeInTheDocument();
});

it("mostra água, atividades e balanço do período", async () => {
  const db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Arroz', 'taco', 100, 128, 2.5, 28, 0.2, ?)`,
    args: [new Date().toISOString()],
  });
  await createEntry(db, 1, { data: hoje(), meal_id: null, food_id: 1, qty_g: 100, measure_id: null, measure_count: null, label: null });
  await addWater(db, 1, hoje(), 1000);
  await createActivitySession(db, 1, { data: hoje(), tipo: "Corrida", duracao_min: 30, kcal: 300 });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><Analise /></DbProvider>
    </QueryClientProvider>,
  );

  // Nutrição tab is default — check water is visible here
  expect(await screen.findByText("Água")).toBeInTheDocument();

  // Switch to Atividade tab
  const ativBtn = screen.getByRole("button", { name: /atividade/i });
  await userEvent.setup().click(ativBtn);

  expect(screen.getByText("Balanço energético")).toBeInTheDocument();
  // saldo = 128 ingerido − 300 gasto = −172
  expect(screen.getByText(/172/)).toBeInTheDocument();
});

it("mostra o painel de treino (sessões/volume/séries + grupo)", async () => {
  const db = await createTestDb();
  await seedMuscleGroups(db);
  const g = await db.execute("SELECT id FROM muscle_groups WHERE nome='Peito'");
  await db.execute({
    sql: "INSERT INTO exercises (nome, grupo_id, created_at) VALUES ('Supino', ?, 't')",
    args: [g.rows[0].id as number],
  });
  const s = await createSession(db, 1, { data: hoje(), nome: "A" });
  await addSet(db, 1, { session_id: s.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><Analise /></DbProvider>
    </QueryClientProvider>,
  );

  // Switch to Atividade tab
  const ativBtn = await screen.findByRole("button", { name: /atividade/i });
  await userEvent.setup().click(ativBtn);

  expect(await screen.findByText("Peito")).toBeInTheDocument();
  expect(screen.getAllByText(/400/).length).toBeGreaterThan(0);
});

it("mostra o painel de peso com o peso atual e o input de registro", async () => {
  const db = await createTestDb();
  await upsertWeighIn(db, 1, hoje(), 80);

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><Analise /></DbProvider>
    </QueryClientProvider>,
  );

  // Switch to Peso tab
  const pesoBtn = await screen.findByRole("button", { name: /^peso$/i });
  await userEvent.setup().click(pesoBtn);

  expect(screen.getByLabelText("registrar peso")).toBeInTheDocument();
  expect((await screen.findAllByText(/80/)).length).toBeGreaterThan(0);
});