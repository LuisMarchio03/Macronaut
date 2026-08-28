import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { MealsConfig } from "./meals-config";
import { createMeal, listMeals } from "../repositories/meals";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <MemoryRouter>
          <MealsConfig />
        </MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

describe("MealsConfig", () => {
  it("adiciona uma refeição", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /adicionar refeição/i }));
    await user.type(screen.getByLabelText(/nome da refeição/i), "Pré-treino");
    await user.click(screen.getByRole("button", { name: /^salvar/i }));
    await waitFor(async () =>
      expect((await listMeals(db, 1)).some((m) => m.nome === "Pré-treino")).toBe(true),
    );
  });

  // O pedido: cadastrei o almoço primeiro e o café depois, e o café tem que
  // abrir o dia. Antes ele nascia no fim e não havia como movê-lo.
  it("refeição nova com horário nasce na posição do horário", async () => {
    const user = userEvent.setup();
    await createMeal(db, 1, { nome: "Almoço", horario: "12:00", ordem: 1 });
    renderPage();
    // Espera a lista carregar: com a tela ainda vazia, o botão que se acha é o
    // do estado vazio, que some no meio do clique quando a consulta responde.
    await screen.findByText("Almoço");

    await user.click(screen.getByRole("button", { name: /adicionar refeição/i }));
    await user.type(await screen.findByLabelText(/nome da refeição/i), "Café da manhã");
    await user.type(screen.getByLabelText(/^horário$/i), "07:00");
    await user.click(screen.getByRole("button", { name: /^salvar/i }));

    await waitFor(async () =>
      expect((await listMeals(db, 1)).map((m) => m.nome)).toEqual(["Café da manhã", "Almoço"]),
    );
  });

  it("a seta para cima troca a refeição com a de cima", async () => {
    const user = userEvent.setup();
    await createMeal(db, 1, { nome: "Almoço", horario: "12:00", ordem: 1 });
    await createMeal(db, 1, { nome: "Café", horario: "07:00", ordem: 2 });
    renderPage();

    await user.click(await screen.findByRole("button", { name: /subir café/i }));

    await waitFor(async () =>
      expect((await listMeals(db, 1)).map((m) => m.nome)).toEqual(["Café", "Almoço"]),
    );
  });

  it("a seta para baixo troca a refeição com a de baixo", async () => {
    const user = userEvent.setup();
    await createMeal(db, 1, { nome: "Almoço", horario: "12:00", ordem: 1 });
    await createMeal(db, 1, { nome: "Café", horario: "07:00", ordem: 2 });
    renderPage();

    await user.click(await screen.findByRole("button", { name: /descer almoço/i }));

    await waitFor(async () =>
      expect((await listMeals(db, 1)).map((m) => m.nome)).toEqual(["Café", "Almoço"]),
    );
  });

  // Setas que nunca fazem nada são ruído: a primeira não sobe, a última não
  // desce, e com uma refeição só não há para onde mover.
  it("a primeira não sobe e a última não desce", async () => {
    await createMeal(db, 1, { nome: "Almoço", horario: "12:00", ordem: 1 });
    await createMeal(db, 1, { nome: "Café", horario: "07:00", ordem: 2 });
    renderPage();

    expect(await screen.findByRole("button", { name: /subir café/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /subir almoço/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /descer café/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /descer almoço/i })).toBeEnabled();
  });
});
