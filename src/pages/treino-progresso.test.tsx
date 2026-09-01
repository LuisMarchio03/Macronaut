import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { TreinoProgresso } from "./treino-progresso";
import { addSet } from "../repositories/workouts";
import { sessaoConcluida } from "../../test/helpers/sessao";
import { seedMuscleGroups } from "../repositories/muscle-groups";
import { criarRotina, salvarDia } from "../repositories/rotina";
import { diaSemana, hoje } from "../lib/date";

/**
 * "O que eu já fiz" — as três visões da spec da rodada 2.
 *
 * A tela nasceu sem teste; estes casos são os da Parte 7, escritos a partir do
 * que a spec promete: nenhuma visão começa vazia, nenhuma usa `<select>`
 * nativo, e uma sessão só de aquecimento se explica em vez de calar (B3).
 */

const USER = 1;
let db: Client;

async function exercicio(nome: string, grupo?: string): Promise<number> {
  let grupoId: number | null = null;
  if (grupo) {
    const g = await db.execute({ sql: "SELECT id FROM muscle_groups WHERE nome=?", args: [grupo] });
    grupoId = g.rows.length ? (g.rows[0].id as number) : null;
  }
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, grupo_id, source, created_at) VALUES (?, ?, 'custom', ?)",
    args: [nome, grupoId, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

const serie = (over: Record<string, unknown> = {}) => ({
  session_id: 0,
  exercise_id: 0,
  ordem: 1,
  reps: 10,
  peso_kg: 40,
  tipo: "valida" as const,
  rir: null,
  nota: null,
  ...over,
});

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <TreinoProgresso />
      </MemoryRouter>
    </Wrapper>,
  );
}

const irPara = (visao: RegExp) => userEvent.click(screen.getByRole("tab", { name: visao }));

beforeEach(async () => {
  db = await createTestDb();
  await seedMuscleGroups(db);
});

describe("Progresso — visão Sessões", () => {
  it("resume cada sessão com séries e volume, e leva ao detalhe", async () => {
    const supino = await exercicio("Supino reto");
    const s = await sessaoConcluida(db, USER, { data: "2026-08-10", nome: "Peito e tríceps" });
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino, reps: 10, peso_kg: 40 }));
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino, ordem: 2, reps: 10, peso_kg: 40 }));

    montar();

    const linha = await screen.findByRole("link", { name: /peito e tríceps/i });
    expect(linha).toHaveAttribute("href", `/treino/sessao/${s.id}`);
    expect(within(linha).getByText(/2 séries · 800 kg de volume/)).toBeInTheDocument();
  });

  // B3: a sessão em que só houve aquecimento aparecia como nome e data e nada mais.
  it("uma sessão só de aquecimento diz 'só aquecimento'", async () => {
    const supino = await exercicio("Supino reto");
    const s = await sessaoConcluida(db, USER, { data: "2026-08-10", nome: "Aquecimento só" });
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino, tipo: "aquecimento" }));

    montar();

    expect(await screen.findByText(/só aquecimento/i)).toBeInTheDocument();
  });

  it("uma sessão sem série nenhuma diz 'nenhuma série registrada'", async () => {
    await sessaoConcluida(db, USER, { data: "2026-08-10", nome: "Abandonada" });

    montar();

    expect(await screen.findByText(/nenhuma série registrada/i)).toBeInTheDocument();
  });

  it("sem sessão nenhuma, explica o que vai aparecer ali", async () => {
    montar();
    expect(await screen.findByText(/nenhuma sessão ainda/i)).toBeInTheDocument();
  });
});

describe("Progresso — visão Exercícios", () => {
  it("lista os exercícios com histórico e a melhor marca, sem select", async () => {
    const supino = await exercicio("Supino reto");
    const s = await sessaoConcluida(db, USER, { data: "2026-08-10", nome: "Peito" });
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino, reps: 5, peso_kg: 60 }));

    montar();
    await irPara(/exercícios/i);

    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect(await screen.findByText(/60 kg/)).toBeInTheDocument();
    // B6/B7: a lista É o conteúdo — nada de `<select>` esperando uma escolha.
    expect(document.querySelector("select")).toBeNull();
  });

  it("tocar no exercício abre o gráfico com as três métricas", async () => {
    const supino = await exercicio("Supino reto");
    const s = await sessaoConcluida(db, USER, { data: "2026-08-10", nome: "Peito" });
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino, reps: 5, peso_kg: 60 }));

    montar();
    await irPara(/exercícios/i);

    const linha = await screen.findByRole("button", { name: /supino reto/i });
    expect(linha).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(linha);

    expect(linha).toHaveAttribute("aria-expanded", "true");
    for (const metrica of [/1rm estimado/i, /carga máxima/i, /volume/i]) {
      expect(screen.getByRole("tab", { name: metrica })).toBeInTheDocument();
    }
  });

  it("sem histórico, convida a registrar em vez de mostrar tela vazia", async () => {
    montar();
    await irPara(/exercícios/i);
    expect(await screen.findByText(/nenhum exercício com histórico/i)).toBeInTheDocument();
  });
});

describe("Progresso — visão Resumo", () => {
  it("mostra quantas vezes a rotina pede por semana e há quanto tempo cada dia não é feito", async () => {
    const r = await criarRotina(db, USER, "R");
    await salvarDia(db, USER, r.id, diaSemana(hoje()), "Peito e tríceps");
    await salvarDia(db, USER, r.id, (diaSemana(hoje()) + 1) % 7, "Perna");

    montar();
    await irPara(/resumo/i);

    expect(await screen.findByText(/2× por semana na rotina/i)).toBeInTheDocument();
    expect(await screen.findByText("Peito e tríceps")).toBeInTheDocument();
    expect((await screen.findAllByText(/nunca feito/i)).length).toBe(2);
  });

  it("mostra séries por grupo muscular na semana", async () => {
    const supino = await exercicio("Supino reto", "Peito");
    // O nome da sessão não pode ser "Peito": o teste procura o GRUPO na tela.
    const s = await sessaoConcluida(db, USER, { data: hoje(), nome: "Treino A" });
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino }));
    await addSet(db, USER, serie({ session_id: s.id, exercise_id: supino, ordem: 2 }));

    montar();
    await irPara(/resumo/i);

    expect(await screen.findByText("Peito")).toBeInTheDocument();
  });

  it("sem série na semana, o gráfico de grupos diz isso em vez de sumir", async () => {
    montar();
    await irPara(/resumo/i);
    expect(await screen.findByText(/nenhuma série registrada nesta semana/i)).toBeInTheDocument();
  });
});
