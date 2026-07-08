import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TacoItem } from "../domain/taco";

const FIXTURE: TacoItem[] = [
  { nome: "Frango, peito, grelhado", base_qty_g: 100, kcal: 159, prot_g: 32, carb_g: 0, gord_g: 2.5 },
];
vi.mock("../hooks/use-taco", () => ({
  useBuscaTaco: (t: string) =>
    t.trim() ? FIXTURE.filter((f) => f.nome.toLowerCase().includes(t.toLowerCase())) : [],
}));

import { FoodForm } from "./food-form";

it("preenche os macros ao escolher um alimento da TACO", async () => {
  const user = userEvent.setup();
  render(<FoodForm onSalvar={() => {}} onCancelar={() => {}} />);
  await user.type(screen.getByLabelText(/nome/i), "frango");
  await user.click(await screen.findByText(/Frango, peito, grelhado/));
  expect((screen.getByLabelText(/kcal/i) as HTMLInputElement).value).toBe("159");
  expect((screen.getByLabelText(/proteína/i) as HTMLInputElement).value).toBe("32");
  expect((screen.getByLabelText(/carbo/i) as HTMLInputElement).value).toBe("0");
  expect((screen.getByLabelText(/gordura/i) as HTMLInputElement).value).toBe("2.5");
  expect((screen.getByLabelText("Base (g)") as HTMLInputElement).value).toBe("100");
});
