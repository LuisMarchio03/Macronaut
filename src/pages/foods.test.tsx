import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { criarApiLocal } from "@/../test/helpers/api-local";
import { Foods } from "./foods";
import { listCustomFoods } from "../repositories/foods";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider api={criarApiLocal(db, 1)}>
        <MemoryRouter>
          <Foods />
        </MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

it("cadastra um alimento custom", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole("button", { name: /novo/i }));
  await user.type(screen.getByLabelText(/nome/i), "Pão");
  await user.type(screen.getByLabelText(/^base$/i), "50");
  await user.type(screen.getByLabelText(/kcal/i), "135");
  await user.type(screen.getByLabelText(/proteína/i), "4");
  await user.type(screen.getByLabelText(/carbo/i), "27");
  await user.type(screen.getByLabelText(/gordura/i), "1");
  await user.click(screen.getByRole("button", { name: /^salvar$/i }));
  await waitFor(async () => expect(await listCustomFoods(db)).toHaveLength(1));
});



async function semear(
  nome: string,
  opts: { source?: string; categoria?: string | null; nome_norm?: string } = {},
) {
  const { source = "taco", categoria = null } = opts;
  await db.execute({
    sql: `INSERT INTO foods (nome, nome_norm, source, base_qty_g, base_unit, kcal, prot_g, carb_g, gord_g, categoria, created_at)
          VALUES (?, ?, ?, 100, 'g', 135, 4, 27, 1, ?, ?)`,
    args: [nome, nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(), source, categoria, new Date().toISOString()],
  });
}

/* ══ a base inteira, e não só o que você cadastrou ═══════════════════════
   A tela listava `source='custom'`. Quem nunca cadastrou nada — a maioria —
   via um estado vazio enquanto 590 alimentos da TACO, já categorizados,
   existiam no banco e só eram alcançáveis por dentro do fluxo de registrar.
   Catálogo que não dá para folhear não é catálogo. */

it("lista a base inteira, não só os alimentos próprios", async () => {
  await semear("Arroz integral cozido", { categoria: "Cereais e derivados" });
  await semear("Meu shake", { source: "custom" });
  renderPage();
  expect(await screen.findByRole("button", { name: /ver ficha de arroz integral cozido/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /ver ficha de meu shake/i })).toBeInTheDocument();
});

it("a busca acha sem digitar o acento", async () => {
  await semear("Açúcar mascavo");
  await semear("Arroz integral cozido");
  renderPage();
  await userEvent.type(await screen.findByLabelText(/buscar alimento/i), "acucar");
  expect(await screen.findByRole("button", { name: /ver ficha de açúcar mascavo/i })).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: /ver ficha de arroz integral cozido/i })).not.toBeInTheDocument(),
  );
});

it("o filtro de categoria mostra só a categoria escolhida", async () => {
  await semear("Arroz integral cozido", { categoria: "Cereais e derivados" });
  await semear("Filé de frango grelhado", { categoria: "Carnes e derivados" });
  renderPage();
  const filtro = await screen.findByLabelText(/filtrar por categoria/i);
  // As categorias vêm de uma query própria: sem esperar, o `<select>` ainda
  // está só com "Todas as categorias".
  await screen.findByRole("option", { name: "Carnes e derivados" });
  await userEvent.selectOptions(filtro, "Carnes e derivados");
  expect(await screen.findByRole("button", { name: /ver ficha de filé de frango grelhado/i })).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: /ver ficha de arroz integral cozido/i })).not.toBeInTheDocument(),
  );
});

it("dá para ver só os seus alimentos", async () => {
  await semear("Arroz integral cozido");
  await semear("Meu shake", { source: "custom" });
  renderPage();
  await userEvent.click(await screen.findByRole("button", { name: /^só os meus$/i }));
  expect(await screen.findByRole("button", { name: /ver ficha de meu shake/i })).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: /ver ficha de arroz integral cozido/i })).not.toBeInTheDocument(),
  );
});

it("tocar num alimento abre a ficha dele", async () => {
  await semear("Arroz integral cozido", { categoria: "Cereais e derivados" });
  renderPage();
  await userEvent.click(await screen.findByRole("button", { name: /ver ficha de arroz integral cozido/i }));
  expect(await screen.findByText(/Nutrientes por 100 g/i)).toBeInTheDocument();
  expect(screen.getByText(/Cereais e derivados · tabela TACO/i)).toBeInTheDocument();
});

it("excluir um alimento seu passa pela ficha e por uma confirmação", async () => {
  const user = userEvent.setup();
  await semear("Pão caseiro", { source: "custom" });
  renderPage();

  await user.click(await screen.findByRole("button", { name: /ver ficha de pão caseiro/i }));
  await user.click(await screen.findByRole("button", { name: /^excluir$/i }));
  // A ficha propõe; a confirmação decide. Nada foi apagado ainda.
  expect(await listCustomFoods(db)).toHaveLength(1);

  await user.click(await screen.findByRole("button", { name: /^excluir$/i }));
  await waitFor(async () => expect(await listCustomFoods(db)).toHaveLength(0));
});
