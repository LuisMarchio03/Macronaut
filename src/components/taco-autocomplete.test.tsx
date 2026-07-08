import { it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TacoItem } from "../domain/taco";

const FIXTURE: TacoItem[] = [
  { nome: "Arroz, integral, cozido", base_qty_g: 100, kcal: 124, prot_g: 2.6, carb_g: 25.8, gord_g: 1.0 },
];
vi.mock("../hooks/use-taco", () => ({
  useBuscaTaco: (t: string) =>
    t.trim() ? FIXTURE.filter((f) => f.nome.toLowerCase().includes(t.toLowerCase())) : [],
}));

import { TacoAutocomplete } from "./taco-autocomplete";

function Wrap({ onSelecionar }: { onSelecionar: (i: TacoItem) => void }) {
  const [v, setV] = useState("");
  return <TacoAutocomplete value={v} onChange={setV} onSelecionar={onSelecionar} placeholder="Nome" />;
}

it("mostra sugestões e dispara onSelecionar ao clicar", async () => {
  const user = userEvent.setup();
  const onSelecionar = vi.fn();
  render(<Wrap onSelecionar={onSelecionar} />);
  await user.type(screen.getByPlaceholderText("Nome"), "arroz");
  await user.click(await screen.findByText(/Arroz, integral, cozido/));
  expect(onSelecionar).toHaveBeenCalledWith(FIXTURE[0]);
});
