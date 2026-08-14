import { it, expect, describe, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { MemoryRouter } from "react-router-dom";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { DataProvider } from "../lib/data-context";
import { Treino } from "./treino";
import { criarPrograma } from "../repositories/programa";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
});

async function comPrograma() {
  const ex = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES ('Agachamento', 'custom', ?)",
    args: [new Date().toISOString()],
  });
  await criarPrograma(db, 1, {
    nome: "5/3/1",
    incremento_kg: 2.5,
    levantamentos: [
      { exercise_id: Number(ex.lastInsertRowid), tm_kg: 130, parte: "inferior" },
    ],
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <MemoryRouter>
          <DataProvider>
            <Treino />
          </DataProvider>
        </MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

describe("sem programa configurado", () => {
  it("convida a configurar em vez de mostrar um caderno em branco", async () => {
    renderPage();
    expect(await screen.findByText(/nenhum programa configurado/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /configurar programa/i })).toHaveAttribute(
      "href",
      "/treino/programa",
    );
  });
});

describe("com programa configurado", () => {
  it("mostra a sessão de hoje com as cargas já calculadas", async () => {
    // O ponto do módulo: a conta é do app, não do usuário.
    // TM 130, semana 1 → 65/75/85% = 84,5→85 · 97,5 · 110,5→110
    await comPrograma();
    renderPage();

    // O nome aparece duas vezes de propósito (título da sessão e lista de
    // levantamentos); a asserção mira o título.
    expect(await screen.findByRole("heading", { name: "Agachamento" })).toBeInTheDocument();
    expect(screen.getByText(/ciclo 1 · semana 1/i)).toBeInTheDocument();
    expect(screen.getByText("5 × 85 kg")).toBeInTheDocument();
    expect(screen.getByText("5 × 97.5 kg")).toBeInTheDocument();
    expect(screen.getByText("5+ × 110 kg")).toBeInTheDocument();
  });

  it("leva para a tela da academia", async () => {
    await comPrograma();
    renderPage();
    expect(await screen.findByRole("link", { name: /começar treino/i })).toHaveAttribute(
      "href",
      "/treino/sessao",
    );
  });

  it("mostra o Training Max de cada levantamento", async () => {
    await comPrograma();
    renderPage();
    expect(await screen.findByText("TM 130 kg")).toBeInTheDocument();
  });
});

describe("o hub deixou de ser um depósito", () => {
  it("cada trabalho virou uma tela própria", async () => {
    // Antes: uma tela só com sessão, cardio, biblioteca e progressão empilhados.
    renderPage();
    await screen.findByText(/nenhum programa configurado/i);
    const destinos = ["/treino/programa", "/treino/progressao", "/treino/historico", "/treino/exercicios", "/treino/cardio"];
    for (const to of destinos) {
      expect(
        document.querySelector(`a[href="${to}"]`),
        `faltou o atalho para ${to}`,
      ).toBeInTheDocument();
    }
  });

  it("não empilha mais o formulário de cardio na tela principal", async () => {
    renderPage();
    await screen.findByText(/nenhum programa configurado/i);
    expect(screen.queryByLabelText(/dura[çc][ãa]o/i)).toBeNull();
  });
});
