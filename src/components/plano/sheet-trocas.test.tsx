import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetTrocas } from "./sheet-trocas";
import type { PlanSwap } from "@/domain/plano-types";

const swap = (p: Partial<PlanSwap> & { id: number }): PlanSwap => ({
  plan_id: 1,
  block_nome: "Café da Manhã",
  categoria: "proteina",
  alimento: `Alimento ${p.id}`,
  porcao: "100g",
  qty_g: 100,
  kcal: 100,
  food_id: null,
  ...p,
});

const SWAPS = [
  swap({ id: 1, categoria: "proteina", alimento: "Ovos inteiros", porcao: "3 unidades (150g)", kcal: 210 }),
  swap({ id: 2, categoria: "proteina", alimento: "Queijo cottage", porcao: "60g", kcal: 70 }),
  swap({ id: 3, categoria: "fruta", alimento: "Banana", porcao: "1 unidade média", kcal: 90 }),
  swap({ id: 4, block_nome: "Janta", categoria: "proteina", alimento: "Peixe branco", kcal: 110 }),
];

const montar = (props: Partial<Parameters<typeof SheetTrocas>[0]> = {}) =>
  render(
    <SheetTrocas
      blockNome="Café da Manhã"
      swaps={SWAPS}
      onEscolher={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe("SheetTrocas", () => {
  it("agrupa as opções por categoria com rótulo legível", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Proteína" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fruta" })).toBeInTheDocument();
  });

  it("mostra só as trocas da refeição pedida", () => {
    // "Peixe branco" pertence à Janta; aparecer aqui sugeriria uma troca que o
    // plano não autoriza para esta refeição.
    montar();
    expect(screen.queryByText("Peixe branco")).toBeNull();
  });

  it("ordena por caloria dentro da categoria", () => {
    montar();
    const proteina = screen.getByRole("heading", { name: "Proteína" }).parentElement!;
    const nomes = within(proteina)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(nomes[0]).toContain("Queijo cottage");
    expect(nomes[1]).toContain("Ovos inteiros");
  });

  it("mostra porção e caloria de cada opção", () => {
    montar();
    expect(screen.getByText("3 unidades (150g)")).toBeInTheDocument();
    expect(screen.getByText("210 kcal")).toBeInTheDocument();
  });

  it("devolve a troca escolhida", async () => {
    const onEscolher = vi.fn();
    montar({ onEscolher });
    await userEvent.click(screen.getByRole("button", { name: /ovos inteiros/i }));
    expect(onEscolher).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("explica o vazio quando o plano não lista trocas para a refeição", () => {
    montar({ blockNome: "Lanche da Tarde" });
    expect(screen.getByText(/não lista substituições/i)).toBeInTheDocument();
  });

  it("casa o nome da refeição ignorando acento e caixa", () => {
    // O nome é digitado à mão em duas abas diferentes da planilha.
    montar({ blockNome: "CAFE DA MANHA" });
    expect(screen.getByText("Ovos inteiros")).toBeInTheDocument();
  });
});
