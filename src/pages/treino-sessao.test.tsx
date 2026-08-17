import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { TreinoSessao } from "./treino-sessao";
import { iniciarSessao, getPlano, type ItemPlanejado } from "../repositories/sessao";
import { listSetsBySession } from "../repositories/workouts";
import { planejar } from "../domain/prescricao";
import { hoje } from "../lib/date";

let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
    args: [nome, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

function item(exercise_id: number, peso: number, nome = "Exercício"): ItemPlanejado {
  return {
    routine_exercise_id: null,
    exercise_id,
    nome,
    descanso_s: 90,
    series: planejar(
      { tipo: "dupla", series: 3, reps_min: 8, reps_max: 12, peso_inicial_kg: peso, incremento_kg: 2.5 },
      [],
    ),
  };
}

function montar(sessionId: number) {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[`/treino/sessao?s=${sessionId}`]}>
        <TreinoSessao />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("TreinoSessao", () => {
  it("mostra o primeiro exercício com as séries já calculadas", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect((await screen.findAllByText(/12 × 40 kg/)).length).toBe(3);
  });

  it("tocar na série registra exatamente o planejado", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /registrar série 1 de supino reto/i }),
    );

    await waitFor(async () => {
      const sets = await listSetsBySession(db, 1, sid);
      expect(sets).toHaveLength(1);
      expect(sets[0].reps).toBe(12);
      expect(sets[0].peso_kg).toBe(40);
    });
  });

  it("desfaz uma série registrada", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /registrar série 1 de supino reto/i }),
    );
    await waitFor(async () => expect(await listSetsBySession(db, 1, sid)).toHaveLength(1));

    await userEvent.click(
      await screen.findByRole("button", { name: /desfazer série 1 de supino reto/i }),
    );
    await waitFor(async () => expect(await listSetsBySession(db, 1, sid)).toHaveLength(0));
  });

  it("o sheet de ajuste grava reps e peso diferentes do planejado", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /ajustar série 1 de supino reto/i }),
    );
    const reps = await screen.findByLabelText(/^reps$/i);
    await userEvent.clear(reps);
    await userEvent.type(reps, "9");
    await userEvent.click(await screen.findByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      const [set] = await listSetsBySession(db, 1, sid);
      expect(set.reps).toBe(9);
      expect(set.peso_kg).toBe(40);
    });
  });

  it("navega entre os exercícios da sessão", async () => {
    const supino = await exercicio("Supino reto");
    const crucifixo = await exercicio("Crucifixo");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(),
      nome: "Peito",
      itens: [item(supino, 40, "Supino reto"), item(crucifixo, 15, "Crucifixo")],
    });
    montar(sid);

    expect(await screen.findByRole("heading", { name: "Supino reto" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Crucifixo" }));
    expect((await screen.findAllByText(/12 × 15 kg/)).length).toBe(3);
  });

  it("mostra o progresso da sessão no topo", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);
    expect(await screen.findByText("0/3")).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", { name: /registrar série 1 de supino reto/i }),
    );
    expect(await screen.findByText("1/3")).toBeInTheDocument();
  });

  it("adiciona um exercício fora da rotina no meio da sessão", async () => {
    const supino = await exercicio("Supino reto");
    await exercicio("Rosca direta");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /adicionar exercício/i }));
    await userEvent.type(await screen.findByLabelText(/exercício/i), "Rosca");
    await userEvent.click(await screen.findByRole("button", { name: /rosca direta/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, 1, sid);
      expect(plano.filter((p) => p.nome === "Rosca direta")).toHaveLength(3);
      expect(plano.at(-1)!.routine_exercise_id).toBeNull();
    });
  });

  it("sessão vazia ainda deixa adicionar o primeiro exercício", async () => {
    const sid = await iniciarSessao(db, 1, { data: hoje(), nome: null, itens: [] });
    montar(sid);
    expect(await screen.findByRole("button", { name: /adicionar exercício/i })).toBeInTheDocument();
  });

  // Antes desta correção a tela ficava presa num esqueleto: `usePlano(undefined)`
  // tem `enabled: false` e no Query v5 nunca sai de `pending`, então a guarda de
  // carregamento nunca abria e este estado era inalcançável.
  it("sem sessão nenhuma, oferece voltar em vez de ficar em branco", async () => {
    const Wrapper = criarWrapper(db);
    render(
      <Wrapper>
        <MemoryRouter initialEntries={["/treino/sessao"]}>
          <TreinoSessao />
        </MemoryRouter>
      </Wrapper>,
    );
    expect(await screen.findByText(/nenhum treino em andamento/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /voltar ao treino/i })).toBeInTheDocument();
  });

  it("a série AMRAP tem contador de repetições e o recorde a bater", async () => {
    const agacho = await exercicio("Agachamento");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(),
      nome: "Perna",
      itens: [{
        routine_exercise_id: null, exercise_id: agacho, nome: "Agachamento", descanso_s: 180,
        series: planejar({ tipo: "531", tm_kg: 100, parte: "inferior", incremento_kg: 2.5 }, []),
      }],
    });
    montar(sid);

    expect(await screen.findByRole("button", { name: /mais uma repetição/i })).toBeInTheDocument();
    expect(await screen.findByText(/primeira vez neste peso/i)).toBeInTheDocument();
  });

  it("registrar a AMRAP grava as reps escolhidas, não as prescritas", async () => {
    const agacho = await exercicio("Agachamento");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(),
      nome: "Perna",
      itens: [{
        routine_exercise_id: null, exercise_id: agacho, nome: "Agachamento", descanso_s: 180,
        series: planejar({ tipo: "531", tm_kg: 100, parte: "inferior", incremento_kg: 2.5 }, []),
      }],
    });
    montar(sid);

    const mais = await screen.findByRole("button", { name: /mais uma repetição/i });
    await userEvent.click(mais);
    await userEvent.click(mais);
    await userEvent.click(mais);
    await userEvent.click(await screen.findByRole("button", { name: /registrar série 6 de agachamento/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, 1, sid);
      const amrap = plano.find((p) => p.amrap)!;
      expect(amrap.reps_feitas).toBe(8); // prescrito 5 + três toques
    });
  });

  it("o aquecimento do 5/3/1 fica num bloco recolhido, separado do trabalho", async () => {
    const agacho = await exercicio("Agachamento");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(),
      nome: "Perna",
      itens: [{
        routine_exercise_id: null, exercise_id: agacho, nome: "Agachamento", descanso_s: 180,
        series: planejar({ tipo: "531", tm_kg: 100, parte: "inferior", incremento_kg: 2.5 }, []),
      }],
    });
    montar(sid);

    const cabecalho = await screen.findByRole("button", { name: /aquecimento/i });
    expect(cabecalho).toHaveAttribute("aria-expanded", "false");
    // Recolhido: as séries de aquecimento não estão na tela até abrir.
    expect(screen.queryByRole("button", { name: /registrar aquecimento 1/i })).not.toBeInTheDocument();

    await userEvent.click(cabecalho);
    expect(await screen.findByRole("button", { name: /registrar aquecimento 1 de agachamento/i })).toBeInTheDocument();
  });

  it("finalizar encerra a sessão de verdade", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /finalizar/i }));
    await waitFor(async () => {
      const rs = await db.execute({
        sql: "SELECT concluida_em FROM workout_sessions WHERE id = ?", args: [sid],
      });
      expect(rs.rows[0].concluida_em).not.toBeNull();
    });
  });
});
