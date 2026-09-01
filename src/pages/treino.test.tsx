import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { Treino } from "./treino";
import { criarRotina, salvarDia, adicionarExercicio } from "../repositories/rotina";
import { sessaoEmCurso } from "../../test/helpers/sessao";
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
const HOJE_ISO = hoje();
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
    expect(await screen.findByRole("button", { name: /treino avulso/i })).toBeInTheDocument();
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

  /**
   * "Hoje" é um painel, não um hub. A navegação do treino são as abas do
   * layout — repeti-la aqui como lista de atalhos (o que a tela fazia) põe o
   * mesmo destino duas vezes na mesma rolagem.
   */
  it("o painel de hoje não repete a navegação das abas", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, HOJE, "Peito");
    await adicionarExercicio(db, 1, d.id, { ...DUPLA, exercise_id: await exercicio("Supino reto") });
    montar();

    // Controle positivo: o painel renderizou o treino de hoje.
    expect(await screen.findByText("Peito")).toBeInTheDocument();
    for (const aba of [/^rotina$/i, /^progresso$/i, /^exercícios$/i]) {
      expect(screen.queryByRole("link", { name: aba })).not.toBeInTheDocument();
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

describe("treino avulso", () => {
  it("é oferecido em dia de treino, não só em dia de descanso", async () => {
    // Num dia que tem rotina não havia caminho nenhum para um treino extra.
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, HOJE, "Peito");
    await adicionarExercicio(db, 1, d.id, { ...DUPLA, exercise_id: await exercicio("Supino reto") });
    montar();

    expect(await screen.findByRole("button", { name: /começar treino/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /treino avulso/i })).toBeInTheDocument();
  });

  it("continua oferecido com uma sessão já aberta", async () => {
    // Treinar duas vezes no mesmo dia acontece; o card só oferecia "retomar".
    await sessaoEmCurso(db, 1, { data: HOJE_ISO, nome: "Manhã", itens: [] });
    const r = await criarRotina(db, 1, "R");
    await salvarDia(db, 1, r.id, HOJE, "Peito");
    montar();

    expect(await screen.findByRole("link", { name: /retomar treino/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /treino avulso/i })).toBeInTheDocument();
  });

  it("uma sessão SEM exercício continua listada para retomar", async () => {
    // O buraco que fazia cada tentativa vazar uma sessão órfã.
    await sessaoEmCurso(db, 1, { data: HOJE_ISO, nome: "Treino avulso", itens: [] });
    await criarRotina(db, 1, "R");
    montar();

    expect(await screen.findByRole("heading", { name: "Treino avulso" })).toBeInTheDocument();
    expect(await screen.findByText(/sem exercício ainda/i)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /retomar treino/i })).toBeInTheDocument();
  });

  it("pergunta o nome antes de criar a sessão", async () => {
    await criarRotina(db, 1, "R");
    montar();
    await userEvent.click(await screen.findByRole("button", { name: /treino avulso/i }));

    const campo = await screen.findByLabelText(/nome/i);
    expect(campo).toHaveValue("Treino avulso");
    await userEvent.clear(campo);
    await userEvent.type(campo, "Corrida no parque");
    await userEvent.click(screen.getByRole("button", { name: /começar/i }));

    await waitFor(async () => {
      const rs = await db.execute("SELECT nome FROM workout_sessions ORDER BY id DESC LIMIT 1");
      expect(rs.rows[0]?.nome).toBe("Corrida no parque");
    });
  });

  it("duas sessões abertas no mesmo dia aparecem as duas", async () => {
    await sessaoEmCurso(db, 1, { data: HOJE_ISO, nome: "Manhã", itens: [] });
    await sessaoEmCurso(db, 1, { data: HOJE_ISO, nome: "Noite", itens: [] });
    await criarRotina(db, 1, "R");
    montar();

    expect(await screen.findByRole("heading", { name: "Manhã" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Noite" })).toBeInTheDocument();
  });
});
