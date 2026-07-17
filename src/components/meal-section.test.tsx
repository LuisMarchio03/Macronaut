import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { MealSection } from "./meal-section";
import { createEntry } from "../repositories/entries";
import { criarDeEntries } from "../repositories/meal-templates";
import type { Food, FoodEntry, FoodMeasure } from "../domain/types";

const pao: Food = {
  id: 1, nome: "Pão de forma", source: "taco", marca: null,
  base_qty_g: 100, base_unit: "g", default_measure_id: null,
  kcal: 250, prot_g: 8, carb_g: 48, gord_g: 3,
  fibra_g: null, sodio_mg: null, categoria: null, created_at: "",
};
const fatia: FoodMeasure = {
  id: 7, food_id: 1, nome: "fatia", qty_base: 25, ordem: 0,
  source: "pof", status: "confirmada", pof_codigo: "301", pof_descricao: null,
};
const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: 1, data: "2026-07-17", meal_id: 1, food_id: 1, qty_g: 50,
  measure_id: 7, measure_count: 2, label: null, created_at: "", ...over,
});

const props = {
  meal: { id: 1, nome: "Café da manhã", horario: "07:30", ordem: 0 },
  foods: new Map([[1, pao]]),
  onAdd: () => {}, onDelete: () => {}, onEdit: () => {},
};

// A MealSection agora consulta o banco (templates + histórico), então todo
// teste precisa do wrapper de query + de um db real com uma favorita "Café
// padrão" no meal 1 e um histórico do café em 2026-07-16 (fonte do "repetir").
let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.executeMultiple(`
    INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
      VALUES ('Pão de forma', 'taco', 100, 250, 8, 48, 3, '2026-01-01');
    INSERT INTO food_measures (food_id, nome, qty_base, ordem) VALUES (1, 'fatia', 25, 0);
    INSERT INTO meals (id, user_id, nome, horario, ordem) VALUES (1, 1, 'Café da manhã', '07:30', 0);
  `);
  await criarDeEntries(db, 1, "Café padrão", 1, [
    entry({ id: 0, food_id: 1, qty_g: 50, measure_id: 1, measure_count: 2 }),
  ]);
  await createEntry(db, 1, {
    data: "2026-07-16", meal_id: 1, food_id: 1, qty_g: 50,
    measure_id: 1, measure_count: 2, label: null,
  });
});

it("exibe '2 fatias (50 g)' em vez de '50g'", () => {
  render(
    <MealSection {...props} entries={[entry({})]} data="2026-07-17" measures={new Map([[1, [fatia]]])} />,
    { wrapper: criarWrapper(db) },
  );
  expect(screen.getByText(/2 fatias \(50 g\)/)).toBeInTheDocument();
});

it("registro legado sem medida continua exibindo grama (item 4)", () => {
  render(
    <MealSection {...props} entries={[entry({ measure_id: null, measure_count: null })]} data="2026-07-17"
      measures={new Map()} />,
    { wrapper: criarWrapper(db) },
  );
  expect(screen.getByText(/50 g/)).toBeInTheDocument();
});

it("singular não pluraliza: 1 fatia", () => {
  render(
    <MealSection {...props} entries={[entry({ qty_g: 25, measure_count: 1 })]} data="2026-07-17"
      measures={new Map([[1, [fatia]]])} />,
    { wrapper: criarWrapper(db) },
  );
  expect(screen.getByText(/1 fatia \(25 g\)/)).toBeInTheDocument();
});

it("soma kcal do painel usa qty_g, não measure_count", () => {
  render(
    <MealSection {...props} entries={[entry({})]} data="2026-07-17" measures={new Map([[1, [fatia]]])} />,
    { wrapper: criarWrapper(db) },
  );
  expect(screen.getByText("125 kcal")).toBeInTheDocument(); // 50g de 250kcal/100g
});

it("refeição vazia oferece favoritas e repetir a última", async () => {
  render(<MealSection {...props} entries={[]} data="2026-07-17" />, { wrapper: criarWrapper(db) });
  expect(await screen.findByRole("button", { name: /^café padrão$/i })).toBeInTheDocument();
  // "repetir" vem de uma query separada (histórico) da de templates: espera
  // por ela explicitamente em vez de getByRole síncrono, para não correr na
  // frente do fetch (a mesma corrida async que já mordeu outras tasks).
  expect(await screen.findByRole("button", { name: /repetir/i })).toBeInTheDocument();
});

it("refeição preenchida não oferece nada disso — só a lista", () => {
  render(
    <MealSection {...props} entries={[entry({})]} data="2026-07-17" measures={new Map([[1, [fatia]]])} />,
    { wrapper: criarWrapper(db) },
  );
  expect(screen.queryByRole("button", { name: /repetir/i })).not.toBeInTheDocument();
});

it("tocar numa favorita registra os itens dela", async () => {
  const user = userEvent.setup();
  render(<MealSection {...props} entries={[]} data="2026-07-17" />, { wrapper: criarWrapper(db) });
  await user.click(await screen.findByRole("button", { name: /^café padrão$/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT COUNT(*) AS n FROM food_entries WHERE data='2026-07-17'");
    expect(rs.rows[0].n).toBe(1);
  });
});

it("remover favorita apaga o template mas não registra nada", async () => {
  const user = userEvent.setup();
  render(<MealSection {...props} entries={[]} data="2026-07-17" />, { wrapper: criarWrapper(db) });
  await user.click(await screen.findByRole("button", { name: /remover favorita café padrão/i }));
  await waitFor(async () => {
    const ts = await db.execute("SELECT COUNT(*) AS n FROM meal_templates");
    expect(ts.rows[0].n).toBe(0);
  });
  // remover a favorita não pode ter registrado comida
  const es = await db.execute("SELECT COUNT(*) AS n FROM food_entries WHERE data='2026-07-17'");
  expect(es.rows[0].n).toBe(0);
});

it("repetir registra os itens da última vez", async () => {
  const user = userEvent.setup();
  render(<MealSection {...props} entries={[]} data="2026-07-17" />, { wrapper: criarWrapper(db) });
  await user.click(await screen.findByRole("button", { name: /repetir/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT COUNT(*) AS n FROM food_entries WHERE data='2026-07-17'");
    expect(Number(rs.rows[0].n)).toBeGreaterThan(0);
  });
});
