import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { criarWrapper } from "../../../test/helpers/query-wrapper";
import { CardCalisteniaHoje } from "./card-hoje";
import { registrarSerie, salvarMeta, seriesDoDia } from "../../repositories/calistenia";

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
        <CardCalisteniaHoje data={DATA} />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => { db = await createTestDb(); });

describe("CardCalisteniaHoje", () => {
  it("soma as séries do dia por exercício", async () => {
    const flexao = await exercicio("Flexão de braço");
    for (const reps of [20, 20]) {
      await registrarSerie(db, 1, {
        data: DATA, exercise_id: flexao, reps, segundos: null, peso_extra_kg: null,
      });
    }
    montar();

    // O nome aparece duas vezes de propósito — na linha do total e no chip de
    // registro —, então o que identifica a linha do total é a soma.
    expect(await screen.findByText("40")).toBeInTheDocument();
    expect(await screen.findAllByText("Flexão de braço")).not.toHaveLength(0);
  });

  it("isometria aparece como relógio, não como número solto", async () => {
    const prancha = await exercicio("Prancha", "segundos");
    await registrarSerie(db, 1, {
      data: DATA, exercise_id: prancha, reps: null, segundos: 90, peso_extra_kg: null,
    });
    montar();

    expect(await screen.findByText("1:30")).toBeInTheDocument();
  });

  it("com meta, mostra o quanto falta", async () => {
    const flexao = await exercicio("Flexão de braço");
    await salvarMeta(db, 1, flexao, 100);
    await registrarSerie(db, 1, {
      data: DATA, exercise_id: flexao, reps: 40, segundos: null, peso_extra_kg: null,
    });
    montar();

    expect(await screen.findByText("40 / 100")).toBeInTheDocument();
  });

  // O chip é o caminho de dois toques: um abre a folha já no exercício certo,
  // o outro confirma.
  it("o chip de um exercício usado abre a folha e grava", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: DATA, exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    await userEvent.click(
      await screen.findByRole("button", { name: /registrar flexão de braço/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect(await seriesDoDia(db, 1, DATA)).toHaveLength(2);
    });
  });

  it("sem histórico nenhum, explica o que o card é", async () => {
    montar();
    expect(await screen.findByText(/flexões e agachamentos soltos/i)).toBeInTheDocument();
  });

  // Um dia sem registro mas com hábito não é um card vazio: os chips continuam
  // lá, que é justamente o convite a fazer a primeira série do dia.
  it("com hábito e nada hoje, ainda oferece os chips", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: "2026-08-27", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    expect(
      await screen.findByRole("button", { name: /registrar flexão de braço/i }),
    ).toBeInTheDocument();
  });
});
