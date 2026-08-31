import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { criarApiLocal } from "@/../test/helpers/api-local";
import { createEntry } from "../repositories/entries";
import { addWater } from "../repositories/water";
import { createActivitySession } from "../repositories/activities";
import { registrarSerie } from "../repositories/calistenia";
import { upsertProfile } from "../repositories/profile";
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
      <DbProvider api={criarApiLocal(db, 1)}><Analise /></DbProvider>
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
      <DbProvider api={criarApiLocal(db, 1)}><Analise /></DbProvider>
    </QueryClientProvider>,
  );

  // Nutrição tab is default — check water is visible here
  expect(await screen.findByText("Água")).toBeInTheDocument();

  // Switch to Atividade tab
  const ativBtn = screen.getByRole("tab", { name: /atividade/i });
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
      <DbProvider api={criarApiLocal(db, 1)}><Analise /></DbProvider>
    </QueryClientProvider>,
  );

  // Switch to Atividade tab
  const ativBtn = await screen.findByRole("tab", { name: /atividade/i });
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
      <DbProvider api={criarApiLocal(db, 1)}><Analise /></DbProvider>
    </QueryClientProvider>,
  );

  // Switch to Peso tab
  const pesoBtn = await screen.findByRole("tab", { name: /^peso$/i });
  await userEvent.setup().click(pesoBtn);

  expect(screen.getByLabelText("registrar peso")).toBeInTheDocument();
  expect((await screen.findAllByText(/80/)).length).toBeGreaterThan(0);
});

/**
 * É o ponto onde o módulo de calistenia responde à pergunta que o motivou: as
 * flexões soltas do dia contam no gasto, do mesmo jeito que a bicicleta.
 *
 * Ela não grava em `activity_sessions` de propósito — a caloria é somada na
 * LEITURA —, então este teste é a única prova de que as duas pontas se ligam.
 */
it("a caloria da calistenia entra no gasto e no balanço", async () => {
  const db = await createTestDb();
  await upsertProfile(db, 1, {
    sexo: "M", data_nascimento: "1998-05-10", altura_cm: 178, peso_kg: 80,
    fator_atividade: 1.55, objetivo: "cut",
    meta_kcal: 2000, meta_prot_g: 150, meta_carb_g: 200, meta_gord_g: 60,
  });
  await db.execute({
    sql: `INSERT INTO exercises
            (user_id, nome, source, equipamento, met, fracao_corporal, created_at)
          VALUES (NULL, 'Flexão de braço', 'catalogo', 'peso_corporal', 8, 0.64, 't')`,
    args: [],
  });
  // 60 reps × 3 s = 180 s. 8 MET × 80 kg × 0,05 h = 32 kcal.
  await registrarSerie(db, 1, {
    data: hoje(), exercise_id: 1, reps: 60, segundos: null, peso_extra_kg: null,
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider api={criarApiLocal(db, 1)}><Analise /></DbProvider>
    </QueryClientProvider>,
  );

  await userEvent.setup().click(await screen.findByRole("tab", { name: /atividade/i }));

  expect(await screen.findByText("calistenia")).toBeInTheDocument();
  expect(screen.getByText("60 reps")).toBeInTheDocument();
  // Duas vezes 32, e é o ponto: o número próprio da calistenia E o gasto
  // total do período, que agora a inclui.
  expect(screen.getAllByText(/^32$/)).toHaveLength(2);
});
