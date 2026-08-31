import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { criarWrapper } from "../../../test/helpers/query-wrapper";
import { LinhaCalisteniaHoje } from "./card-hoje";
import { registrarSerie, seriesDoDia } from "../../repositories/calistenia";

const DATA = "2026-08-28";
let db: Client;

async function exercicio(nome: string, medida: string | null = null): Promise<number> {
  const rs = await db.execute({
    sql: `INSERT INTO exercises
            (user_id, nome, source, equipamento, met, fracao_corporal, medida, created_at)
          VALUES (NULL, ?, 'catalogo', 'peso_corporal', 8, 0.64, ?, 't')`,
    args: [nome, medida],
  });
  return Number(rs.lastInsertRowid);
}

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <LinhaCalisteniaHoje data={DATA} />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => { db = await createTestDb(); });

/**
 * A calistenia no dashboard é UMA LINHA.
 *
 * Era um card com estado vazio, lista de totais e chips — repetido também na
 * aba "Hoje" do treino. Muito espaço para algo que talvez nem aconteça hoje,
 * e a mesma história contada em duas telas. O aprofundamento agora é a aba
 * `/treino/calistenia`; aqui fica o resumo e o `+`.
 */
describe("LinhaCalisteniaHoje", () => {
  it("resume o dia numa linha, somando as séries por exercício", async () => {
    const flexao = await exercicio("Flexão de braço");
    for (const reps of [20, 20]) {
      await registrarSerie(db, 1, {
        data: DATA, exercise_id: flexao, reps, segundos: null, peso_extra_kg: null,
      });
    }
    montar();

    expect(await screen.findByText("Flexão de braço 40")).toBeInTheDocument();
  });

  it("isometria aparece como relógio, não como número solto", async () => {
    const prancha = await exercicio("Prancha", "segundos");
    await registrarSerie(db, 1, {
      data: DATA, exercise_id: prancha, reps: null, segundos: 90, peso_extra_kg: null,
    });
    montar();

    expect(await screen.findByText("Prancha 1:30")).toBeInTheDocument();
  });

  it("acima de dois exercícios vira contagem, que é o que cabe na linha", async () => {
    for (const nome of ["Flexão", "Agachamento", "Barra"]) {
      await registrarSerie(db, 1, {
        data: DATA, exercise_id: await exercicio(nome), reps: 10, segundos: null, peso_extra_kg: null,
      });
    }
    montar();

    expect(await screen.findByText("3 exercícios")).toBeInTheDocument();
  });

  it("dia sem registro diz isso, sem ocupar um card inteiro", async () => {
    montar();
    expect(await screen.findByText("nada registrado hoje")).toBeInTheDocument();
    // O texto longo de convite morava aqui e foi para a aba.
    expect(screen.queryByText(/flexões e agachamentos soltos/i)).toBeNull();
  });

  it("leva para a aba da calistenia", async () => {
    montar();
    const linha = await screen.findByRole("link", { name: /calistenia/i });
    expect(linha).toHaveAttribute("href", "/treino/calistenia");
  });

  it("o registro em dois toques sobrevive: o + abre a folha e grava", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: DATA, exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    await userEvent.click(
      await screen.findByRole("button", { name: /registrar série de calistenia/i }),
    );
    // A folha abre sem exercício escolhido: o `+` do dashboard é o caminho
    // curto, e a escolha por atalho mora na aba.
    await userEvent.type(await screen.findByRole("combobox"), "flex");
    await userEvent.click(await screen.findByRole("button", { name: /flexão de braço/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect(await seriesDoDia(db, 1, DATA)).toHaveLength(2);
    });
  });
});
