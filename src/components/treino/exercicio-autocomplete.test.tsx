import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExercicioAutocomplete } from "./exercicio-autocomplete";
import type { Exercise } from "../../domain/types";

function ex(id: number, nome: string, grupo_nome: string | null, source: "catalogo" | "custom"): Exercise {
  return {
    id, nome, grupo_nome, source,
    user_id: source === "custom" ? 1 : null,
    grupo_muscular: null, grupo_id: null, tipo: null, equipamento: null,
    created_at: "2026-07-16T00:00:00.000Z",
  };
}

const LISTA = [
  ex(1, "Supino reto com barra", "Peito", "catalogo"),
  ex(2, "Supino inclinado com halteres", "Peito", "catalogo"),
  ex(3, "Agachamento livre", "Quadríceps", "catalogo"),
  ex(4, "Meu exercício", null, "custom"),
];

it("filtra por nome e ignora acento e caixa", async () => {
  render(<ExercicioAutocomplete exercicios={LISTA} selecionado={null} onSelecionar={vi.fn()} />);
  await userEvent.type(screen.getByRole("combobox"), "agach");
  expect(screen.getByText("Agachamento livre")).toBeInTheDocument();
  expect(screen.queryByText("Supino reto com barra")).not.toBeInTheDocument();
});

it("mostra grupo e origem na sugestão", async () => {
  render(<ExercicioAutocomplete exercicios={LISTA} selecionado={null} onSelecionar={vi.fn()} />);
  await userEvent.type(screen.getByRole("combobox"), "meu");
  expect(screen.getByText(/sem grupo/i)).toBeInTheDocument();
  expect(screen.getByText(/seu/i)).toBeInTheDocument();
});

it("chama onSelecionar com o exercício clicado", async () => {
  const onSelecionar = vi.fn();
  render(<ExercicioAutocomplete exercicios={LISTA} selecionado={null} onSelecionar={onSelecionar} />);
  await userEvent.type(screen.getByRole("combobox"), "supino inc");
  await userEvent.click(screen.getByText("Supino inclinado com halteres"));
  expect(onSelecionar).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
});

it("mostra o nome do selecionado no input", () => {
  render(<ExercicioAutocomplete exercicios={LISTA} selecionado={LISTA[0]} onSelecionar={vi.fn()} />);
  expect(screen.getByRole("combobox")).toHaveValue("Supino reto com barra");
});

it("avisa quando a busca não encontra nada", async () => {
  render(<ExercicioAutocomplete exercicios={LISTA} selecionado={null} onSelecionar={vi.fn()} />);
  await userEvent.type(screen.getByRole("combobox"), "zzzz");
  expect(screen.getByText(/nenhum exercício/i)).toBeInTheDocument();
});

it("ignora acento de verdade, nao so caixa (bíceps casa com bíceps)", async () => {
  const comAcento = [...LISTA, ex(5, "Rosca direta para bíceps", "Braço", "catalogo")];
  render(<ExercicioAutocomplete exercicios={comAcento} selecionado={null} onSelecionar={vi.fn()} />);
  await userEvent.type(screen.getByRole("combobox"), "biceps");
  expect(screen.getByText("Rosca direta para bíceps")).toBeInTheDocument();
});
