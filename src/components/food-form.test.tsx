import { it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import type { TacoItem } from "../domain/taco";

const FIXTURE: TacoItem[] = [
  { nome: "Frango, peito, grelhado", base_qty_g: 100, kcal: 159, prot_g: 32, carb_g: 0, gord_g: 2.5 },
];
vi.mock("../hooks/use-taco", () => ({
  useBuscaTaco: (t: string) =>
    t.trim() ? FIXTURE.filter((f) => f.nome.toLowerCase().includes(t.toLowerCase())) : [],
}));

import { FoodForm } from "./food-form";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
});

it("preenche os macros ao escolher um alimento da TACO", async () => {
  const user = userEvent.setup();
  render(<FoodForm onSalvar={() => {}} onCancelar={() => {}} />);
  await user.type(screen.getByLabelText(/nome/i), "frango");
  await user.click(await screen.findByText(/Frango, peito, grelhado/));
  expect((screen.getByLabelText(/kcal/i) as HTMLInputElement).value).toBe("159");
  expect((screen.getByLabelText(/proteína/i) as HTMLInputElement).value).toBe("32");
  expect((screen.getByLabelText(/carbo/i) as HTMLInputElement).value).toBe("0");
  expect((screen.getByLabelText(/gordura/i) as HTMLInputElement).value).toBe("2.5");
  expect((screen.getByLabelText("Base") as HTMLInputElement).value).toBe("100");
});

it("emite base_unit escolhida em vez de 'g' fixo", async () => {
  const user = userEvent.setup();
  const onSalvar = vi.fn();
  render(<FoodForm onSalvar={onSalvar} onCancelar={() => {}} />, { wrapper: criarWrapper(db) });
  await user.type(screen.getByLabelText(/nome/i), "Ovo");
  await user.type(screen.getByLabelText(/^kcal$/i), "70");
  await user.selectOptions(screen.getByLabelText(/unidade base/i), "un");
  await user.click(screen.getByRole("button", { name: /salvar/i }));
  expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ base_unit: "un" }));
});

it("emite fibra e sódio", async () => {
  const user = userEvent.setup();
  const onSalvar = vi.fn();
  render(<FoodForm onSalvar={onSalvar} onCancelar={() => {}} />, { wrapper: criarWrapper(db) });
  await user.type(screen.getByLabelText(/nome/i), "Aveia");
  await user.type(screen.getByLabelText(/^kcal$/i), "390");
  await user.type(screen.getByLabelText(/fibra/i), "9.1");
  await user.type(screen.getByLabelText(/sódio/i), "5");
  await user.click(screen.getByRole("button", { name: /salvar/i }));
  expect(onSalvar).toHaveBeenCalledWith(
    expect.objectContaining({ fibra_g: 9.1, sodio_mg: 5 }),
  );
});

it("editor de medidas só aparece em alimento já salvo (precisa de id)", () => {
  render(<FoodForm onSalvar={() => {}} onCancelar={() => {}} />, { wrapper: criarWrapper(db) });
  expect(screen.queryByText(/medidas caseiras/i)).not.toBeInTheDocument();
});
