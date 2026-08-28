import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { TreinoCalistenia } from "./treino-calistenia";
import { listarMetas, registrarSerie, salvarMeta, seriesDoDia } from "../repositories/calistenia";
import { upsertProfile } from "../repositories/profile";
import { diasAtras, hoje } from "../lib/date";

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

async function comPerfil(): Promise<void> {
  await upsertProfile(db, 1, {
    sexo: "M", data_nascimento: "1998-05-10", altura_cm: 178, peso_kg: 80,
    fator_atividade: 1.55, objetivo: "cut",
    meta_kcal: 2000, meta_prot_g: 150, meta_carb_g: 200, meta_gord_g: 60,
  });
}

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <TreinoCalistenia />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => { db = await createTestDb(); });

describe("TreinoCalistenia — Hoje", () => {
  it("lista as séries do dia com a quantidade de cada uma", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: hoje(), exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    expect(await screen.findByText(/20 reps/i)).toBeInTheDocument();
  });

  it("isometria aparece em mm:ss", async () => {
    const prancha = await exercicio("Prancha", "segundos");
    await registrarSerie(db, 1, {
      data: hoje(), exercise_id: prancha, reps: null, segundos: 90, peso_extra_kg: null,
    });
    montar();

    expect(await screen.findByText("1:30")).toBeInTheDocument();
  });

  it("apaga uma série do dia", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: hoje(), exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /excluir série/i }));

    await waitFor(async () => {
      expect(await seriesDoDia(db, 1, hoje())).toHaveLength(0);
    });
  });

  it("sem registro nenhum, mostra o estado vazio", async () => {
    montar();
    expect(await screen.findByText(/nenhuma série registrada/i)).toBeInTheDocument();
  });
});

describe("TreinoCalistenia — Semana", () => {
  it("traz o total e o recorde de série por exercício", async () => {
    await comPerfil();
    const flexao = await exercicio("Flexão de braço");
    for (const reps of [20, 35]) {
      await registrarSerie(db, 1, {
        data: hoje(), exercise_id: flexao, reps, segundos: null, peso_extra_kg: null,
      });
    }
    montar();

    await userEvent.click(await screen.findByRole("tab", { name: /^semana$/i }));

    expect(await screen.findByText("55")).toBeInTheDocument();
    expect(await screen.findByText(/recorde 35/i)).toBeInTheDocument();
  });

  it("mostra a sequência de dias", async () => {
    await comPerfil();
    const flexao = await exercicio("Flexão de braço");
    for (const data of [diasAtras(hoje(), 1), hoje()]) {
      await registrarSerie(db, 1, {
        data, exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
      });
    }
    montar();

    await userEvent.click(await screen.findByRole("tab", { name: /^semana$/i }));

    expect(await screen.findByText(/sequência/i)).toBeInTheDocument();
    expect(await screen.findByText("2")).toBeInTheDocument();
  });
});

describe("TreinoCalistenia — Metas", () => {
  it("cria uma meta diária", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: hoje(), exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    await userEvent.click(await screen.findByRole("tab", { name: /^metas$/i }));
    await userEvent.type(await screen.findByLabelText(/meta diária de flexão de braço/i), "100");
    await userEvent.click(await screen.findByRole("button", { name: /salvar meta de flexão/i }));

    await waitFor(async () => {
      const metas = await listarMetas(db, 1);
      expect(metas[0].alvo_dia).toBe(100);
    });
  });

  it("remove uma meta existente", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: hoje(), exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    await salvarMeta(db, 1, flexao, 100);
    montar();

    await userEvent.click(await screen.findByRole("tab", { name: /^metas$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /remover meta de flexão/i }));

    await waitFor(async () => {
      expect(await listarMetas(db, 1)).toHaveLength(0);
    });
  });

  it("sem exercício usado, explica que a meta nasce do uso", async () => {
    montar();
    await userEvent.click(await screen.findByRole("tab", { name: /^metas$/i }));
    expect(await screen.findByText(/registre uma série primeiro/i)).toBeInTheDocument();
  });
});
