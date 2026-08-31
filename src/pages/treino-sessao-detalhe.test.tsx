import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { TreinoSessaoDetalhe } from "./treino-sessao-detalhe";
import {
  getPlano,
  iniciarSessao,
  registrarCardio,
  registrarSerie,
  type ItemPlanejado,
} from "../repositories/sessao";
import { addSet, createSession, getSession, listSetsBySession } from "../repositories/workouts";
import { planejar } from "../domain/prescricao";

/**
 * "O que eu fiz naquele dia" — a tela que usa o que a rodada da rotina tornou
 * possível: o plano guarda o prescrito, `workout_sets` guarda o realizado.
 *
 * Casos da Parte 7 da spec da rodada 2: prescrito × realizado, sessão antiga
 * sem plano, e corrigir na segunda-feira a carga que foi digitada errada de pé
 * na academia.
 */

const USER = 1;
let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
    args: [nome, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

function item(exercise_id: number, peso: number, nome: string): ItemPlanejado {
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
      <MemoryRouter initialEntries={[`/treino/sessao/${sessionId}`]}>
        <Routes>
          <Route path="/treino/sessao/:id" element={<TreinoSessaoDetalhe />} />
          <Route path="/treino/progresso" element={<p>voltou ao progresso</p>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("Detalhe da sessão — prescrito ao lado do realizado", () => {
  it("marca a série em que o realizado divergiu do prescrito", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-10", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    montar(sid);

    expect(await screen.findByText("10 × 40 kg")).toBeInTheDocument();
    expect(await screen.findByText(/prescrito 12 × 40 kg/i)).toBeInTheDocument();
  });

  it("a série que não foi feita aparece como não feita, com o que era para ser", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-10", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });

    montar(sid);

    expect((await screen.findAllByText(/^não feita$/i)).length).toBe(3);
    expect((await screen.findAllByText("12 × 40 kg")).length).toBe(3);
  });

  it("um item de cardio mostra duração e calorias, não reps e carga", async () => {
    const bike = await exercicio("Bicicleta");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-10",
      nome: "Cardio",
      itens: [
        {
          routine_exercise_id: null,
          exercise_id: bike,
          nome: "Bicicleta",
          descanso_s: null,
          series: planejar({ tipo: "cardio", duracao_min: 30, met: 7.5 }, []),
        },
      ],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarCardio(db, USER, plano[0].id, { duracao_min: 30, kcal: 308 });

    montar(sid);

    expect(await screen.findByText(/30 min · 308 kcal/)).toBeInTheDocument();
    // Cardio não se corrige por reps e carga: o lápis é de série de peso.
    expect(screen.queryByRole("button", { name: /editar série/i })).not.toBeInTheDocument();
  });
});

describe("Detalhe da sessão — corrigir o passado", () => {
  it("corrigir a carga de uma série já registrada atualiza o que ficou gravado", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-10", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /editar série 1 de supino reto/i }),
    );
    const peso = await screen.findByLabelText(/peso \(kg\)/i);
    await userEvent.clear(peso);
    await userEvent.type(peso, "45");
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      const sets = await listSetsBySession(db, USER, sid);
      expect(sets).toHaveLength(1);
      expect(sets[0].peso_kg).toBe(45);
    });
  });

  it("registrar pelo detalhe a série que ficou faltando naquele dia", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-10", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });

    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /editar série 3 de supino reto/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      const sets = await listSetsBySession(db, USER, sid);
      expect(sets).toHaveLength(1);
      expect(sets[0].ordem).toBe(3);
    });
  });

  it("excluir a sessão apaga e volta para o progresso", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-10", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });

    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /excluir esta sessão/i }));
    // A exclusão passa por uma confirmação: apagar sessão não tem desfazer.
    await userEvent.click(await screen.findByRole("button", { name: /^excluir$/i }));

    expect(await screen.findByText(/voltou ao progresso/i)).toBeInTheDocument();
    const rs = await db.execute("SELECT COUNT(*) AS n FROM workout_sessions");
    expect(Number(rs.rows[0].n)).toBe(0);
  });
});

describe("Detalhe da sessão — sessões anteriores a esta arquitetura", () => {
  it("sem plano, mostra só o realizado e diz por que não há prescrito", async () => {
    const supino = await exercicio("Supino reto");
    const s = await createSession(db, USER, { data: "2026-07-01", nome: "Treino antigo" });
    await addSet(db, USER, {
      session_id: s.id, exercise_id: supino, ordem: 1, reps: 10, peso_kg: 50,
      tipo: "valida", rir: null, nota: null,
    });

    montar(s.id);

    expect(await screen.findByText(/anterior ao plano de treino/i)).toBeInTheDocument();
    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect(screen.queryByText(/não feita/i)).not.toBeInTheDocument();
  });

  it("sessão sem plano e sem série nenhuma se explica em vez de ficar em branco", async () => {
    const s = await createSession(db, USER, { data: "2026-07-01", nome: "Vazia" });

    montar(s.id);

    expect(await screen.findByText(/sessão sem exercício/i)).toBeInTheDocument();
  });

  it("a sessão vazia deixa de ser um beco sem saída: dá para adicionar exercício", async () => {
    // Era o fim da linha do treino avulso — a tela oferecia só "excluir".
    const s = await createSession(db, USER, { data: "2026-07-01", nome: "Treino avulso" });
    await exercicio("Supino reto");
    montar(s.id);

    await userEvent.click(await screen.findByRole("button", { name: /adicionar exercício/i }));
    await userEvent.type(screen.getByRole("combobox"), "supino");
    await userEvent.click(await screen.findByRole("button", { name: /supino reto/i }));

    await waitFor(async () => {
      const rs = await db.execute("SELECT COUNT(*) AS n FROM session_plan_sets");
      expect(Number(rs.rows[0].n)).toBe(3);
    });
  });

  it("dá para adicionar exercício numa sessão que já tem plano", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-07-01", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    await exercicio("Rosca direta");
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /adicionar exercício/i }));
    await userEvent.type(screen.getByRole("combobox"), "rosca");
    await userEvent.click(await screen.findByRole("button", { name: /rosca direta/i }));

    await waitFor(async () => {
      const rs = await db.execute(
        "SELECT COUNT(DISTINCT exercise_id) AS n FROM session_plan_sets WHERE session_id=?",
        [sid],
      );
      expect(Number(rs.rows[0].n)).toBe(2);
    });
  });

  /**
   * Excluir uma sessão apaga o treino e todas as séries dele, e não há desfazer.
   * Um toque só, sem pergunta, era o custo errado para uma ação irreversível.
   */
  it("excluir a sessão pede confirmação antes de apagar", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-07-20", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /excluir esta sessão/i }));

    // Ainda existe: o toque abriu a pergunta, não executou a exclusão.
    const antes = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM workout_sessions WHERE id=?", args: [sid],
    });
    expect(Number(antes.rows[0].n)).toBe(1);

    await userEvent.click(await screen.findByRole("button", { name: /^excluir$/i }));

    await waitFor(async () => {
      const rs = await db.execute({
        sql: "SELECT COUNT(*) AS n FROM workout_sessions WHERE id=?", args: [sid],
      });
      expect(Number(rs.rows[0].n)).toBe(0);
    });
  });

  it("cancelar a confirmação deixa a sessão intacta", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-07-20", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /excluir esta sessão/i }));
    await userEvent.click(await screen.findByRole("button", { name: /cancelar/i }));

    const rs = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM workout_sessions WHERE id=?", args: [sid],
    });
    expect(Number(rs.rows[0].n)).toBe(1);
  });
});

/* ══════════════════════════════════════════════════════════════════
   EDITAR A SESSÃO REGISTRADA

   Corrigir uma série já dava; trocar o exercício errado, tirar o que não foi
   feito e consertar o dia em que o treino caiu, não. A única ação disponível
   era excluir a sessão inteira — que leva junto tudo que estava certo.
   ══════════════════════════════════════════════════════════════════ */

describe("Detalhe da sessão — editar", () => {
  it("remove um exercício da sessão", async () => {
    const supino = await exercicio("Supino reto");
    const rosca = await exercicio("Rosca direta");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17",
      nome: "Peito",
      itens: [item(supino, 40, "Supino reto"), item(rosca, 12, "Rosca direta")],
    });
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /editar exercício supino reto/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /remover da sessão/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^remover$/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, USER, sid);
      expect(plano.every((p) => p.nome === "Rosca direta")).toBe(true);
    });
  });

  it("troca o exercício de um bloco", async () => {
    const supino = await exercicio("Supino reto");
    await exercicio("Supino inclinado");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /editar exercício supino reto/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /trocar exercício/i }));
    await userEvent.type(await screen.findByRole("combobox"), "Supino incl");
    await userEvent.click(await screen.findByRole("button", { name: /^supino inclinado/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, USER, sid);
      expect(plano[0].nome).toBe("Supino inclinado");
    });
  });

  // Treino registrado atrasado cai no dia errado, e a data era a única coisa
  // que nenhuma tela sabia corrigir.
  it("corrige a data da sessão", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /editar sessão/i }));
    const campoData = await screen.findByLabelText(/^data$/i);
    await userEvent.clear(campoData);
    await userEvent.type(campoData, "2026-08-16");
    await userEvent.click(await screen.findByRole("button", { name: /^salvar$/i }));

    await waitFor(async () => {
      expect((await getSession(db, USER, sid))!.data).toBe("2026-08-16");
    });
  });

  it("renomeia a sessão", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /editar sessão/i }));
    const campoNome = await screen.findByLabelText(/nome do treino/i);
    await userEvent.clear(campoNome);
    await userEvent.type(campoNome, "Peito e tríceps");
    await userEvent.click(await screen.findByRole("button", { name: /^salvar$/i }));

    await waitFor(async () => {
      expect((await getSession(db, USER, sid))!.nome).toBe("Peito e tríceps");
    });
  });
});
