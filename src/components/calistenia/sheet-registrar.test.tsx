import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { criarWrapper } from "../../../test/helpers/query-wrapper";
import { SheetRegistrarCalistenia } from "./sheet-registrar";
import { seriesDoDia } from "../../repositories/calistenia";
import type { Medida } from "../../domain/calistenia";

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

function montar(
  inicial: { exercise_id: number; nome: string; medida: Medida; ultima_qtd: number } | null,
) {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <SheetRegistrarCalistenia
        aberto
        onFechar={() => {}}
        data={DATA}
        exercicioInicial={inicial}
      />
    </Wrapper>,
  );
}

beforeEach(async () => { db = await createTestDb(); });

describe("SheetRegistrarCalistenia", () => {
  // O stepper abre na última quantidade porque quem faz 20 flexões toda vez
  // não deve ter que digitar 20 toda vez. Dois toques: abrir e confirmar.
  it("abre com a última quantidade e grava com um toque", async () => {
    const flexao = await exercicio("Flexão de braço");
    montar({ exercise_id: flexao, nome: "Flexão de braço", medida: "reps", ultima_qtd: 20 });

    expect(await screen.findByText("20")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      const series = await seriesDoDia(db, 1, DATA);
      expect(series).toHaveLength(1);
      expect(series[0].reps).toBe(20);
    });
  });

  it("o stepper soma e subtrai", async () => {
    const flexao = await exercicio("Flexão de braço");
    montar({ exercise_id: flexao, nome: "Flexão de braço", medida: "reps", ultima_qtd: 20 });

    await userEvent.click(await screen.findByRole("button", { name: /^mais$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect((await seriesDoDia(db, 1, DATA))[0].reps).toBe(21);
    });
  });

  // Zero repetição não é uma série, e o CHECK do banco recusaria a linha.
  it("nunca desce abaixo do passo", async () => {
    const flexao = await exercicio("Flexão de braço");
    montar({ exercise_id: flexao, nome: "Flexão de braço", medida: "reps", ultima_qtd: 1 });

    await userEvent.click(await screen.findByRole("button", { name: /^menos$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect((await seriesDoDia(db, 1, DATA))[0].reps).toBe(1);
    });
  });

  // Prancha se conta em segundos, e o passo de 1 em 1 seria absurdo nela.
  it("isometria grava em segundos e anda de 5 em 5", async () => {
    const prancha = await exercicio("Prancha", "segundos");
    montar({ exercise_id: prancha, nome: "Prancha", medida: "segundos", ultima_qtd: 60 });

    expect(await screen.findByText("1:00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^mais$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      const [s] = await seriesDoDia(db, 1, DATA);
      expect(s.segundos).toBe(65);
      expect(s.reps).toBeNull();
    });
  });

  it("sem exercício escolhido, escolher um pela busca abre o stepper", async () => {
    await exercicio("Agachamento livre sem peso");
    montar(null);

    await userEvent.type(await screen.findByRole("combobox"), "Agacha");
    await userEvent.click(
      await screen.findByRole("button", { name: /^agachamento livre sem peso/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect(await seriesDoDia(db, 1, DATA)).toHaveLength(1);
    });
  });

  // Escolher a prancha pela busca tem que trazer a medida dela junto: sem
  // isso a folha gravaria "60 repetições de prancha".
  it("escolher um isométrico pela busca já abre em segundos", async () => {
    await exercicio("Prancha", "segundos");
    montar(null);

    await userEvent.type(await screen.findByRole("combobox"), "Pranc");
    await userEvent.click(await screen.findByRole("button", { name: /^prancha/i }));

    expect(await screen.findByText(/segundos/i)).toBeInTheDocument();
  });

  it("o peso extra vai junto quando informado", async () => {
    const barra = await exercicio("Barra fixa pronada");
    montar({ exercise_id: barra, nome: "Barra fixa pronada", medida: "reps", ultima_qtd: 8 });

    await userEvent.type(await screen.findByLabelText(/peso extra/i), "10");
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect((await seriesDoDia(db, 1, DATA))[0].peso_extra_kg).toBe(10);
    });
  });
});
