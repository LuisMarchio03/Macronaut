import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { Treino } from "./treino";
import { criarRotina, salvarDia, adicionarExercicio } from "../repositories/rotina";
import { diaSemana, hoje } from "../lib/date";

let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
    args: [nome, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

/** Uma prescrição de dupla progressão, para não repetir o objeto em todo teste. */
const DUPLA = {
  prescricao: "dupla" as const,
  series: 3,
  reps_min: 8,
  reps_max: 12,
  peso_kg: 40,
  incremento_kg: 2.5,
  tm_kg: null,
  parte: null,
  descanso_s: 90, duracao_min: null,
};

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <Treino />
      </MemoryRouter>
    </Wrapper>,
  );
}

/** O dia da semana de hoje, para o teste montar a rotina no dia certo sem
 *  depender de quando ele roda. */
const HOJE = diaSemana(hoje());
const AMANHA = (HOJE + 1) % 7;

beforeEach(async () => {
  db = await createTestDb();
});

describe("Treino — o hub", () => {
  it("sem rotina, convida a montar uma", async () => {
    montar();
    expect(await screen.findByText(/nenhuma rotina configurada/i)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /montar rotina/i })).toBeInTheDocument();
  });

  it("em dia de treino, mostra o treino de hoje com as cargas", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, HOJE, "Peito e tríceps");
    await adicionarExercicio(db, 1, d.id, { ...DUPLA, exercise_id: await exercicio("Supino reto") });
    montar();

    expect(await screen.findByText("Peito e tríceps")).toBeInTheDocument();
    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect(await screen.findByText(/3 × 12 × 40 kg/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /começar treino/i })).toBeInTheDocument();
  });

  it("em dia de descanso, mostra qual é o próximo treino", async () => {
    const r = await criarRotina(db, 1, "R");
    await salvarDia(db, 1, r.id, AMANHA, "Costas e bíceps");
    montar();

    expect(await screen.findByRole("heading", { name: /descanso/i })).toBeInTheDocument();
    expect(await screen.findByText(/costas e bíceps/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /treinar mesmo assim/i })).toBeInTheDocument();
  });

  it("começar o treino materializa a sessão", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, HOJE, "Peito");
    await adicionarExercicio(db, 1, d.id, { ...DUPLA, exercise_id: await exercicio("Supino reto") });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /começar treino/i }));

    await waitFor(async () => {
      const rs = await db.execute("SELECT COUNT(*) AS n FROM session_plan_sets");
      expect(Number(rs.rows[0].n)).toBe(3);
    });
  });

  it("com sessão em andamento, o card vira retomar", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, HOJE, "Peito");
    await adicionarExercicio(db, 1, d.id, { ...DUPLA, exercise_id: await exercicio("Supino reto") });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /começar treino/i }));
    expect(await screen.findByRole("link", { name: /retomar treino/i })).toBeInTheDocument();
    expect(await screen.findByText(/0 de 3 séries/i)).toBeInTheDocument();
  });

  // Dois destinos, não cinco: o hub deixou de ser um menu de objetos.
  it("o hub tem só os atalhos de rotina e progresso", async () => {
    montar();
    for (const [nome, destino] of [
      [/^rotina/i, "/treino/rotina"], // "Montar rotina" do estado vazio também casaria sem a âncora
      [/^progresso/i, "/treino/progresso"],
    ] as const) {
      const link = await screen.findByRole("link", { name: nome });
      expect(link).toHaveAttribute("href", destino);
    }
    for (const morto of [/histórico/i, /cardio/i]) {
      expect(screen.queryByRole("link", { name: morto })).not.toBeInTheDocument();
    }
  });

  /**
   * O resumo do card lê `peso_kg` para decidir o que dizer, e cardio tem peso
   * zero de propósito — a leitura literal dava "1 séries · definir carga" para
   * uma bicicleta de 30 minutos.
   */
  it("descreve cardio do dia por duração, não por carga a definir", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, HOJE, "Cardio");
    const rs = await db.execute({
      sql: `INSERT INTO exercises (nome, source, equipamento, met, created_at)
            VALUES ('Bicicleta', 'catalogo', 'cardio', 7.5, ?)`,
      args: [new Date().toISOString()],
    });
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: Number(rs.lastInsertRowid),
      prescricao: "cardio", series: 3, reps_min: null, reps_max: 12,
      peso_kg: 0, incremento_kg: 2.5, tm_kg: null, parte: null,
      descanso_s: 90, duracao_min: 30,
    });
    montar();

    expect(await screen.findByText("Bicicleta")).toBeInTheDocument();
    expect(await screen.findByText(/30 min/)).toBeInTheDocument();
    expect(screen.queryByText(/definir carga/i)).not.toBeInTheDocument();
  });
});
