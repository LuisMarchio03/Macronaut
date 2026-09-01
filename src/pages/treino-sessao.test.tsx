import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { TreinoSessao } from "./treino-sessao";
import { criarSessao, iniciarSessao, finalizarSessao, getPlano, type ItemPlanejado } from "../repositories/sessao";
import { sessaoEmCurso } from "../../test/helpers/sessao";
import { addSet, createSession, listSetsBySession } from "../repositories/workouts";
import { planejar } from "../domain/prescricao";
import { hoje } from "../lib/date";
import { upsertProfile } from "../repositories/profile";

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
  // O cronômetro persiste por `session_id`, e o banco de teste reinicia a
  // sequência a cada arquivo — sem limpar, o descanso de um teste vazaria
  // para o seguinte por colisão de id.
  localStorage.clear();
});

describe("TreinoSessao", () => {
  it("mostra o primeiro exercício com as séries já calculadas", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect((await screen.findAllByText(/12 × 40 kg/)).length).toBe(3);
  });

  it("tocar na série registra exatamente o planejado", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await sessaoEmCurso(db, 1, {
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
    const sid = await sessaoEmCurso(db, 1, {
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
    const sid = await sessaoEmCurso(db, 1, {
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
    const sid = await sessaoEmCurso(db, 1, {
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
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);
    expect(await screen.findByText(/0\/3/)).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole("button", { name: /registrar série 1 de supino reto/i }),
    );
    expect(await screen.findByText(/1\/3/)).toBeInTheDocument();
  });

  it("adiciona um exercício fora da rotina no meio da sessão", async () => {
    const supino = await exercicio("Supino reto");
    await exercicio("Rosca direta");
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /adicionar exercício/i }));
    // Pelo papel, e não pelo rótulo: "Editar exercício Supino reto" também
    // casa com /exercício/i, e o campo de busca é o único combobox da tela.
    await userEvent.type(await screen.findByRole("combobox"), "Rosca");
    await userEvent.click(await screen.findByRole("button", { name: /rosca direta/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, 1, sid);
      expect(plano.filter((p) => p.nome === "Rosca direta")).toHaveLength(3);
      expect(plano.at(-1)!.routine_exercise_id).toBeNull();
    });
  });

  it("sessão vazia ainda deixa adicionar o primeiro exercício", async () => {
    const sid = await sessaoEmCurso(db, 1, { data: hoje(), nome: null, itens: [] });
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
    const sid = await sessaoEmCurso(db, 1, {
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
    const sid = await sessaoEmCurso(db, 1, {
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
    const sid = await sessaoEmCurso(db, 1, {
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
    const sid = await sessaoEmCurso(db, 1, {
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

/**
 * Cardio dentro da sessão.
 *
 * O critério de aceite da spec é o balanço energético: 30 minutos de bicicleta
 * registrados dentro do treino têm que valer as mesmas calorias que a tela de
 * cardio antiga produzia — e nenhuma linha de bike pode cair em `workout_sets`,
 * onde vive levantamento de peso e onde ela quebraria volume, 1RM e progressão.
 */
describe("TreinoSessao — cardio", () => {
  async function comPeso(kg: number) {
    await upsertProfile(db, 1, {
      sexo: "M", data_nascimento: "1995-01-01", altura_cm: 180, peso_kg: kg,
      fator_atividade: 1.55, objetivo: "manutencao",
      meta_kcal: 2500, meta_prot_g: 180, meta_carb_g: 280, meta_gord_g: 70,
    });
  }

  /** Como `seedExerciciosDeCardio` semeia: equipamento 'cardio' e o MET junto. */
  async function exercicioDeCardio(nome: string, met: number): Promise<number> {
    const rs = await db.execute({
      sql: `INSERT INTO exercises (nome, source, equipamento, met, created_at)
            VALUES (?, 'catalogo', 'cardio', ?, ?)`,
      args: [nome, met, new Date().toISOString()],
    });
    return Number(rs.lastInsertRowid);
  }

  function bike(exercise_id: number): ItemPlanejado {
    return {
      routine_exercise_id: null,
      exercise_id,
      nome: "Bicicleta",
      descanso_s: null,
      series: planejar({ tipo: "cardio", duracao_min: 30, met: 7.5 }, []),
    };
  }

  it("mostra duração e a kcal estimada pelo MET e pelo peso do perfil", async () => {
    await comPeso(80);
    const b = await exercicioDeCardio("Bicicleta", 7.5);
    const sid = await sessaoEmCurso(db, 1, { data: hoje(), nome: "Cardio", itens: [bike(b)] });
    montar(sid);

    expect(await screen.findByText("30 min")).toBeInTheDocument();
    // 7,5 MET × 80 kg × 0,5 h = 300 kcal
    expect(await screen.findByText(/≈ 300 kcal/)).toBeInTheDocument();
  });

  it("registrar grava em activity_sessions, e nada em workout_sets", async () => {
    await comPeso(80);
    const b = await exercicioDeCardio("Bicicleta", 7.5);
    const sid = await sessaoEmCurso(db, 1, { data: hoje(), nome: "Cardio", itens: [bike(b)] });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /registrar bicicleta/i }));

    await waitFor(async () => {
      const at = await db.execute("SELECT tipo, duracao_min, kcal FROM activity_sessions");
      expect(at.rows).toHaveLength(1);
      expect(at.rows[0].tipo).toBe("Bicicleta");
      expect(Number(at.rows[0].duracao_min)).toBe(30);
      expect(Number(at.rows[0].kcal)).toBe(300);
    });
    expect(await listSetsBySession(db, 1, sid)).toHaveLength(0);
  });

  it("desfazer apaga a atividade registrada", async () => {
    await comPeso(80);
    const b = await exercicioDeCardio("Bicicleta", 7.5);
    const sid = await sessaoEmCurso(db, 1, { data: hoje(), nome: "Cardio", itens: [bike(b)] });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /registrar bicicleta/i }));
    await userEvent.click(await screen.findByRole("button", { name: /desfazer bicicleta/i }));

    await waitFor(async () => {
      const at = await db.execute("SELECT COUNT(*) AS n FROM activity_sessions");
      expect(Number(at.rows[0].n)).toBe(0);
    });
  });

  // Sem peso não há estimativa honesta — o app pede o peso em vez de inventar.
  it("sem perfil, pede o peso em vez de inventar um número", async () => {
    const b = await exercicioDeCardio("Bicicleta", 7.5);
    const sid = await sessaoEmCurso(db, 1, { data: hoje(), nome: "Cardio", itens: [bike(b)] });
    montar(sid);

    expect(await screen.findByText(/defina seu peso nas metas/i)).toBeInTheDocument();
  });

  /**
   * Cardio é a única linha da sessão sem escape: as séries de peso têm o
   * lápis, e a bike registrava sempre o prescrito. Pedalar 22 dos 30 minutos
   * gravava 30 — e a kcal errada ia para o balanço energético.
   */
  it("ajustar cardio grava a duração e a kcal que de fato aconteceram", async () => {
    await comPeso(80);
    const b = await exercicioDeCardio("Bicicleta", 7.5);
    const sid = await sessaoEmCurso(db, 1, { data: hoje(), nome: "Cardio", itens: [bike(b)] });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /ajustar bicicleta/i }));
    const dur = await screen.findByLabelText(/duração/i);
    await userEvent.clear(dur);
    await userEvent.type(dur, "22");
    await userEvent.click(await screen.findByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      const at = await db.execute("SELECT duracao_min, kcal FROM activity_sessions");
      expect(at.rows).toHaveLength(1);
      expect(Number(at.rows[0].duracao_min)).toBe(22);
      // 7,5 MET × 80 kg × 22/60 h = 220 kcal
      expect(Number(at.rows[0].kcal)).toBe(220);
    });
  });

  /**
   * O caminho da rotina cruza o histórico do exercício (`montarPlanoDoDia`); o
   * de adicionar no meio do treino não cruzava, e todo exercício avulso nascia
   * a zero quilo mesmo com dez sessões dele no banco.
   */
  it("exercício adicionado no meio do treino herda a carga do histórico", async () => {
    const supino = await exercicio("Supino reto");
    const antiga = await createSession(db, 1, { data: "2020-01-01", nome: "Antigo" });
    for (const ordem of [1, 2, 3]) {
      await addSet(db, 1, {
        session_id: antiga.id, exercise_id: supino, ordem,
        reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
      });
    }

    const rosca = await exercicio("Rosca direta");
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(rosca, 10, "Rosca direta")],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /adicionar exercício/i }));
    await userEvent.type(await screen.findByRole("combobox"), "Supino");
    await userEvent.click(await screen.findByRole("button", { name: /supino reto/i }));

    await waitFor(async () => {
      const novas = (await getPlano(db, 1, sid)).filter((p) => p.exercise_id === supino);
      expect(novas).toHaveLength(3);
      // 3×12 a 40 kg é o topo da faixa em todas: a dupla progressão sobe 2,5 kg.
      expect(novas.map((p) => p.peso_kg)).toEqual([42.5, 42.5, 42.5]);
    });
  });

  /**
   * O cabeçalho lia sempre a sessão em andamento de HOJE, então abrir uma
   * sessão antiga pela URL a rotulava com o nome do treino de hoje.
   */
  it("abrir uma sessão pela URL mostra o nome dela, não o da sessão de hoje", async () => {
    const supino = await exercicio("Supino reto");
    const antiga = await sessaoEmCurso(db, 1, {
      data: "2020-01-01", nome: "Costas", itens: [item(supino, 40, "Supino reto")],
    });
    await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito de hoje", itens: [item(supino, 40, "Supino reto")],
    });
    montar(antiga);

    expect(await screen.findByText("Costas")).toBeInTheDocument();
    expect(screen.queryByText("Peito de hoje")).not.toBeInTheDocument();
  });
});

describe("TreinoSessao — a ficha do exercício", () => {
  /**
   * "Como faz isso mesmo?" é pergunta de academia, com a barra na mão. A
   * resposta estava a quatro toques e uma tela de distância.
   */
  it("o nome do exercício abre a ficha dele sem sair da sessão", async () => {
    const rs = await db.execute({
      sql: `INSERT INTO exercises (nome, source, tipo, equipamento, instrucoes, created_at)
            VALUES ('Supino reto', 'catalogo', 'composto', 'barra', 'Deite no banco.', ?)`,
      args: [new Date().toISOString()],
    });
    const supino = Number(rs.lastInsertRowid);
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /ver ficha de supino reto/i }));
    expect(await screen.findByText("Deite no banco.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /google/i })).toBeInTheDocument();

    // Modal, não destino: fechar devolve a sessão exatamente onde estava.
    await userEvent.keyboard("{Escape}");
    expect(
      await screen.findByRole("button", { name: /registrar série 1 de supino reto/i }),
    ).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════════
   EDITAR A SESSÃO

   Até aqui a sessão só crescia: dava para adicionar exercício e corrigir
   série, nunca para remover, trocar ou reordenar. Um exercício escolhido por
   engano ficava lá para sempre, e a única saída era apagar o treino inteiro.
   ══════════════════════════════════════════════════════════════════ */

describe("TreinoSessao — editar", () => {
  async function comDoisExercicios() {
    const supino = await exercicio("Supino reto");
    const rosca = await exercicio("Rosca direta");
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(),
      nome: "Peito",
      itens: [item(supino, 40, "Supino reto"), item(rosca, 12, "Rosca direta")],
    });
    return { supino, rosca, sid };
  }

  it("remove o exercício da sessão", async () => {
    const { sid } = await comDoisExercicios();
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /editar exercício supino reto/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /remover da sessão/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^remover$/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, 1, sid);
      expect(plano.map((p) => p.nome)).toEqual([
        "Rosca direta", "Rosca direta", "Rosca direta",
      ]);
    });
  });

  it("troca o exercício, levando as séries já registradas junto", async () => {
    const { sid } = await comDoisExercicios();
    await exercicio("Supino inclinado");
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /registrar série 1 de supino reto/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /editar exercício supino reto/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /trocar exercício/i }));
    await userEvent.type(await screen.findByRole("combobox"), "Supino incl");
    await userEvent.click(await screen.findByRole("button", { name: /^supino inclinado/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, 1, sid);
      expect(plano[0].nome).toBe("Supino inclinado");
    });
    const sets = await listSetsBySession(db, 1, sid);
    expect(sets).toHaveLength(1);
  });

  it("move o exercício para baixo", async () => {
    const { sid } = await comDoisExercicios();
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /editar exercício supino reto/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /mover para baixo/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, 1, sid);
      expect(plano[0].nome).toBe("Rosca direta");
    });
  });

  it("adiciona uma série ao exercício", async () => {
    const { sid, supino } = await comDoisExercicios();
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /editar exercício supino reto/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /adicionar série/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, 1, sid);
      expect(plano.filter((p) => p.exercise_id === supino)).toHaveLength(4);
    });
  });

  it("remove a última série do exercício", async () => {
    const { sid, supino } = await comDoisExercicios();
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /editar exercício supino reto/i }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /remover última série/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, 1, sid);
      expect(plano.filter((p) => p.exercise_id === supino)).toHaveLength(2);
    });
  });

  // Com um exercício só não há para onde mover, e mover é o único par de ações
  // que depende de ter vizinho.
  it("não oferece mover quando o exercício é o único da sessão", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /editar exercício supino reto/i }),
    );

    expect(await screen.findByRole("button", { name: /remover da sessão/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mover para cima/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /mover para baixo/i })).toBeNull();
  });
});

describe("cronômetro de descanso na sessão", () => {
  it("está na tela ANTES da primeira série, para dar para cronometrar aquecimento", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    expect(await screen.findByText("Descanso")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Iniciar descanso" })).toBeInTheDocument();
  });

  it("registrar a série põe o cronômetro a correr", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /registrar série 1 de supino reto/i }),
    );

    // Correndo = tem como pausar. Antes o primeiro descanso nascia parado em
    // produção, porque a guarda dependia da ordem dos efeitos do React.
    expect(await screen.findByRole("button", { name: "Pausar descanso" })).toBeInTheDocument();
  });

  it("o cabeçalho mostra há quanto tempo o treino começou", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await sessaoEmCurso(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    expect(await screen.findByText(/agora · 0\/3/)).toBeInTheDocument();
  });
});

describe("TreinoSessao — o rodapé segue o estado da sessão", () => {
  it("rascunho oferece iniciar, não finalizar", async () => {
    const sid = await criarSessao(db, 1, { data: hoje(), nome: "Avulso", itens: [] });
    montar(sid);

    expect(await screen.findByRole("button", { name: /iniciar treino/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finalizar/i })).not.toBeInTheDocument();
  });

  it("iniciar marca o começo e passa a oferecer finalizar", async () => {
    const sid = await criarSessao(db, 1, { data: hoje(), nome: "Avulso", itens: [] });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /iniciar treino/i }));

    expect(await screen.findByRole("button", { name: /finalizar/i })).toBeInTheDocument();
    const rs = await db.execute({
      sql: "SELECT iniciado_em FROM workout_sessions WHERE id = ?", args: [sid],
    });
    expect(rs.rows[0].iniciado_em).not.toBeNull();
  });

  it("descartar apaga a sessão", async () => {
    const sid = await criarSessao(db, 1, { data: hoje(), nome: "Avulso", itens: [] });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /descartar/i }));
    // O sheet de confirmação: o segundo "Descartar" é o que age.
    const botoes = await screen.findAllByRole("button", { name: /^descartar$/i });
    await userEvent.click(botoes[botoes.length - 1]);

    await waitFor(async () => {
      const rs = await db.execute({
        sql: "SELECT id FROM workout_sessions WHERE id = ?", args: [sid],
      });
      expect(rs.rows).toHaveLength(0);
    });
  });

  it("sessão concluída não oferece finalizar de novo", async () => {
    const sid = await criarSessao(db, 1, { data: hoje(), nome: "Peito", itens: [] });
    await iniciarSessao(db, 1, sid);
    await finalizarSessao(db, 1, sid);
    montar(sid);

    expect(await screen.findByText(/treino concluído/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finalizar/i })).not.toBeInTheDocument();
  });

  it("registrar uma série num rascunho começa o treino sozinho", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await criarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40, "Supino reto")],
    });
    montar(sid);

    await userEvent.click(
      await screen.findByRole("button", { name: /registrar série 1 de supino reto/i }),
    );

    await waitFor(async () => {
      const rs = await db.execute({
        sql: "SELECT iniciado_em FROM workout_sessions WHERE id = ?", args: [sid],
      });
      expect(rs.rows[0].iniciado_em).not.toBeNull();
    });
  });
});
