import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { MemoryRouter } from "react-router-dom";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { criarApiLocal } from "@/../test/helpers/api-local";
import { DataProvider } from "../lib/data-context";
import { Dashboard } from "./dashboard";
import { iniciarSessao } from "../repositories/sessao";
import { hoje } from "../lib/date";
import { upsertProfile } from "../repositories/profile";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider api={criarApiLocal(db, 1)}>
        <MemoryRouter><DataProvider><Dashboard /></DataProvider></MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

it("sem perfil, mostra CTA para definir metas", async () => {
  renderPage();
  await waitFor(() =>
    expect(screen.getByRole("link", { name: /definir metas/i })).toBeInTheDocument(),
  );
});

/**
 * B9 — duas telas contando a mesma história.
 *
 * Com um treino aberto, o hub `/treino` mostra o progresso e oferece retomar;
 * o dashboard dizia "Ver séries e cargas" e levava ao hub, como se nada
 * estivesse acontecendo.
 */
function serie(ordem: number) {
  return {
    ordem,
    peso_kg: 40,
    reps_alvo: 12,
    reps_min: 8,
    tipo: "valida" as const,
    amrap: false,
    pct: null,
    duracao_min: null,
  };
}

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
    args: [nome, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

/** O dashboard sem perfil é só o convite a definir metas — o card de treino
 *  nem chega a ser renderizado. */
async function comPerfil() {
  await upsertProfile(db, 1, {
    sexo: "M",
    data_nascimento: "1995-01-01",
    altura_cm: 180,
    peso_kg: 80,
    fator_atividade: 1.55,
    objetivo: "manutencao",
    meta_kcal: 2500,
    meta_prot_g: 180,
    meta_carb_g: 280,
    meta_gord_g: 70,
  });
}

it("com sessão em andamento, o card de treino mostra o progresso e leva para ela", async () => {
  await comPerfil();
  const sessionId = await iniciarSessao(db, 1, {
    data: hoje(),
    nome: "Peito e tríceps",
    itens: [
      {
        routine_exercise_id: null,
        exercise_id: await exercicio("Supino reto"),
        nome: "Supino reto",
        descanso_s: 90,
        series: [serie(1), serie(2), serie(3)],
      },
    ],
  });

  renderPage();

  expect(await screen.findByText(/0 de 3 séries/i)).toBeInTheDocument();
  const link = await screen.findByRole("link", { name: /peito e tríceps/i });
  expect(link).toHaveAttribute("href", `/treino/sessao?s=${sessionId}`);
});
