import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { FavoritarRefeicao } from "./favoritar-refeicao";
import { listTemplates, listTemplateItems } from "../repositories/meal-templates";
import type { FoodEntry } from "../domain/types";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.executeMultiple(`
    INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
      VALUES ('Pão', 'taco', 100, 250, 8, 48, 3, '2026-01-01');
    INSERT INTO meals (user_id, nome, horario, ordem) VALUES (1, 'Café', '07:30', 0);
  `);
});

const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: 1, data: "2026-07-16", meal_id: 1, food_id: 1, qty_g: 50,
  measure_id: null, measure_count: 2, label: null, created_at: "2026-07-16T07:00:00Z", ...over,
});

it("não aparece em refeição vazia", () => {
  render(<FavoritarRefeicao mealId={1} entries={[]} sugestaoNome="Café padrão" />, {
    wrapper: criarWrapper(db),
  });
  expect(screen.queryByLabelText(/favoritar/i)).not.toBeInTheDocument();
});

it("favoritar grava um snapshot com os itens da refeição", async () => {
  const user = userEvent.setup();
  render(
    <FavoritarRefeicao mealId={1} entries={[entry({ food_id: 1 })]} sugestaoNome="Café padrão" />,
    { wrapper: criarWrapper(db) },
  );

  await user.click(screen.getByLabelText(/favoritar/i));
  const input = screen.getByLabelText(/nome da favorita/i);
  expect(input).toHaveValue("Café padrão"); // vem da sugestão
  await user.clear(input);
  await user.type(input, "Meu café");
  await user.click(screen.getByRole("button", { name: /salvar/i }));

  await waitFor(async () => {
    const ts = await listTemplates(db, 1);
    expect(ts.map((t) => t.nome)).toEqual(["Meu café"]);
  });
  const ts = await listTemplates(db, 1);
  const itens = await listTemplateItems(db, ts[0].id);
  expect(itens).toHaveLength(1);
  expect(itens[0].food_id).toBe(1);
  expect(itens[0].measure_count).toBe(2); // snapshot preservou a intenção
});

it("reabrir após cancelar não herda o nome digitado antes", async () => {
  const user = userEvent.setup();
  render(
    <FavoritarRefeicao mealId={1} entries={[entry({})]} sugestaoNome="Café padrão" />,
    { wrapper: criarWrapper(db) },
  );

  await user.click(screen.getByLabelText(/favoritar/i));
  await user.clear(screen.getByLabelText(/nome da favorita/i));
  await user.type(screen.getByLabelText(/nome da favorita/i), "rascunho descartado");
  await user.click(screen.getByRole("button", { name: /cancelar/i }));

  // reabre — deve mostrar a sugestão fresca, não "rascunho descartado"
  await user.click(screen.getByLabelText(/favoritar/i));
  expect(screen.getByLabelText(/nome da favorita/i)).toHaveValue("Café padrão");
});
