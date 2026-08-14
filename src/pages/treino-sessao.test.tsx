import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { MemoryRouter } from "react-router-dom";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { TreinoSessao } from "./treino-sessao";
import { criarPrograma, listSessoesDoPrograma, getProgramaAtivo } from "../repositories/programa";

let db: Client;
let exerciseId: number;

beforeEach(async () => {
  db = await createTestDb();
  const ex = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES ('Agachamento', 'custom', ?)",
    args: [new Date().toISOString()],
  });
  exerciseId = Number(ex.lastInsertRowid);
  await criarPrograma(db, 1, {
    nome: "5/3/1",
    incremento_kg: 2.5,
    levantamentos: [{ exercise_id: exerciseId, tm_kg: 130, parte: "inferior" }],
  });
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <MemoryRouter>
          <TreinoSessao />
        </MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

/* TM 130, semana 1 → trabalho 65/75/85% = 85 · 97,5 · 110 */

describe("a sessão já vem calculada", () => {
  it("mostra as séries de trabalho com carga e reps prontas", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /5 repetições com 85 quilos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /5 repetições com 97.5 quilos/i })).toBeInTheDocument();
  });

  it("mostra o Training Max de onde as cargas saem", async () => {
    renderPage();
    expect(await screen.findByText("Training Max 130 kg")).toBeInTheDocument();
  });

  it("esconde o aquecimento por padrão", async () => {
    // Aquecimento é ritual, não decisão: não deve ocupar a tela.
    renderPage();
    await screen.findByText("Aquecimento");
    expect(screen.queryByRole("button", { name: /5 repetições com 52.5 quilos/i })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /aquecimento/i }));
    expect(screen.getByText("5 × 52.5 kg")).toBeInTheDocument();
  });
});

describe("registrar séries", () => {
  it("um toque registra a série prescrita", async () => {
    renderPage();
    const serie = await screen.findByRole("button", { name: /5 repetições com 85 quilos/i });
    expect(serie).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(serie);
    expect(serie).toHaveAttribute("aria-pressed", "true");
  });

  it("tocar de novo desfaz", async () => {
    renderPage();
    const serie = await screen.findByRole("button", { name: /5 repetições com 85 quilos/i });
    await userEvent.click(serie);
    await userEvent.click(serie);
    expect(serie).toHaveAttribute("aria-pressed", "false");
  });

  it("o botão de finalizar conta o que já foi feito", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /5 repetições com 85 quilos/i }));
    expect(screen.getByRole("button", { name: /finalizar \(1 de 3\)/i })).toBeInTheDocument();
  });

  it("não deixa finalizar sem nenhuma série", async () => {
    renderPage();
    await screen.findByText("Training Max 130 kg");
    expect(screen.getByRole("button", { name: /finalizar/i })).toBeDisabled();
  });
});

describe("a série AMRAP", () => {
  it("é a única com contador de repetições", async () => {
    renderPage();
    await screen.findByText("Training Max 130 kg");
    // Um contador só, o da última série.
    expect(screen.getAllByRole("button", { name: /mais uma repeti/i })).toHaveLength(1);
    expect(screen.getByText("reps")).toBeInTheDocument();
  });

  it("começa nas reps prescritas — quem faz o mínimo não mexe no contador", async () => {
    renderPage();
    await screen.findByText("Training Max 130 kg");
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("dá para subir e descer", async () => {
    renderPage();
    await screen.findByText("Training Max 130 kg");
    await userEvent.click(screen.getByRole("button", { name: /mais uma repeti/i }));
    await userEvent.click(screen.getByRole("button", { name: /mais uma repeti/i }));
    expect(screen.getByText("7")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /menos uma repeti/i }));
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("na primeira vez naquele peso, não promete recorde", async () => {
    // Não havia marca a bater; chamar de recorde barateia a palavra.
    renderPage();
    expect(await screen.findByText(/primeira vez neste peso/i)).toBeInTheDocument();
  });
});

describe("recorde", () => {
  it("mostra a marca a bater e avisa quando ela é superada", async () => {
    // Semeia uma AMRAP anterior de 6 reps a 110 kg.
    const s = await db.execute({
      sql: "INSERT INTO workout_sessions (user_id, data, created_at) VALUES (1, '2026-07-01', ?)",
      args: [new Date().toISOString()],
    });
    await db.execute({
      sql: `INSERT INTO workout_sets (user_id, session_id, exercise_id, ordem, reps, peso_kg, tipo, amrap, created_at)
            VALUES (1, ?, ?, 1, 6, 110, 'valida', 1, ?)`,
      args: [Number(s.lastInsertRowid), exerciseId, new Date().toISOString()],
    });

    renderPage();
    expect(await screen.findByText(/seu recorde neste peso/i)).toBeInTheDocument();

    // 5 prescritas → sobe até 7 para passar das 6.
    const mais = screen.getByRole("button", { name: /mais uma repeti/i });
    await userEvent.click(mais);
    expect(screen.queryByText(/novo recorde/i)).toBeNull(); // 6 empata, não supera
    await userEvent.click(mais);
    expect(screen.getByText(/novo recorde/i)).toBeInTheDocument();
  });
});

describe("concluir a sessão", () => {
  it("grava as séries e faz o programa avançar", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /5 repetições com 85 quilos/i }));
    await userEvent.click(screen.getByRole("button", { name: /5 repetições com 97.5 quilos/i }));
    await userEvent.click(screen.getByRole("button", { name: /registrar série/i }));
    await userEvent.click(screen.getByRole("button", { name: /finalizar treino/i }));

    const programa = (await getProgramaAtivo(db, 1))!;
    await waitFor(async () =>
      expect(await listSessoesDoPrograma(db, 1, programa.id)).toHaveLength(1),
    );

    const sessoes = await listSessoesDoPrograma(db, 1, programa.id);
    expect(sessoes[0]).toMatchObject({ ciclo: 1, semana: 1, tm_kg: 130 });

    const sets = await db.execute("SELECT reps, peso_kg, prescribed_pct, amrap FROM workout_sets ORDER BY ordem");
    expect(sets.rows).toHaveLength(3);
    expect(sets.rows[2]).toMatchObject({ peso_kg: 110, prescribed_pct: 85, amrap: 1 });
  });
});
