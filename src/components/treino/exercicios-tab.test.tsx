import { it, expect, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { DbProvider } from "../../lib/db-context";
import { criarApiLocal } from "@/../test/helpers/api-local";
import { ExerciciosTab } from "./exercicios-tab";
import { listExercises, seedExercicios } from "../../repositories/exercises";
import { seedMuscleGroups } from "../../repositories/muscle-groups";
import { seedExerciciosDeCardio } from "../../db/seed-cardio";
import { createSession, addSet } from "../../repositories/workouts";

const USER_ID = 1;

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

async function idDoGrupo(nome: string): Promise<number> {
  const rs = await db.execute({ sql: "SELECT id FROM muscle_groups WHERE nome=?", args: [nome] });
  return rs.rows[0].id as number;
}

async function inserirExercicioCustom(nome: string, grupo: string | null): Promise<number> {
  const grupo_id = grupo ? await idDoGrupo(grupo) : null;
  const rs = await db.execute({
    sql: `INSERT INTO exercises (user_id, nome, grupo_id, source, created_at) VALUES (?, ?, ?, 'custom', ?)`,
    args: [USER_ID, nome, grupo_id, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

/**
 * Monta a aba Exercícios sobre um banco já com os 12 grupos semeados (a UI
 * depende do `<select>` deles independente do cenário).
 *
 * - `exercicios`: cria exercícios `custom` do usuário. `grupo` é o NOME do
 *   grupo (casado contra `muscle_groups`); `null` simula o resultado de um
 *   backfill que não casou (`grupo_id` fica NULL).
 * - `comCatalogo`: roda o seed real do catálogo (`seedExercicios`), então
 *   "Supino reto com barra" e os demais ~76 itens de catálogo aparecem.
 * - `exercicioEmUso`: cria um exercício `custom` sem grupo e grava uma série
 *   nele, para exercitar a recusa de exclusão por "em_uso".
 */
async function montar(opts: {
  exercicios?: { nome: string; grupo: string | null }[];
  comCatalogo?: boolean;
  comCardio?: boolean;
  exercicioEmUso?: boolean;
} = {}) {
  await seedMuscleGroups(db);
  if (opts.comCatalogo) await seedExercicios(db);
  if (opts.comCardio) {
    // `seedExerciciosDeCardio` deriva de `activity_types`, que num banco de
    // teste nasce vazio — o seed real roda depois do de tipos de atividade.
    await db.execute("INSERT INTO activity_types (nome, met) VALUES ('Bicicleta', 7.5)");
    await seedExerciciosDeCardio(db);
  }
  for (const e of opts.exercicios ?? []) await inserirExercicioCustom(e.nome, e.grupo);
  if (opts.exercicioEmUso) {
    const exId = await inserirExercicioCustom("Exercício em uso", null);
    const sessao = await createSession(db, USER_ID, { data: "2026-07-16", nome: null });
    await addSet(db, USER_ID, {
      session_id: sessao.id, exercise_id: exId, ordem: 1,
      reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });
  }

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider api={criarApiLocal(db, 1)}><ExerciciosTab /></DbProvider>
    </QueryClientProvider>,
  );
  // Espera as duas queries (exercícios + grupos) hidratarem antes de devolver
  // o controle ao teste: no primeiro render `exercicios`/`grupos` ainda estão
  // no default `[]` dos hooks, e sem esta espera as asserções a seguir veem
  // esse estado inicial (falso "vazio"), não os dados semeados acima.
  await waitFor(() => {
    expect(qc.getQueryState(["exercises", USER_ID])?.status).toBe("success");
    expect(qc.getQueryState(["muscle-groups"])?.status).toBe("success");
  });

  return { db };
}

it("cadastra um exercício", async () => {
  const user = userEvent.setup();
  await montar();
  await user.click(screen.getByRole("button", { name: /novo exerc/i }));
  await user.type(screen.getByLabelText(/^nome$/i), "Supino");
  await user.click(screen.getByRole("button", { name: /^salvar$/i }));
  await waitFor(async () => expect(await listExercises(db, USER_ID)).toHaveLength(1));
});

// Nomes escolhidos de propósito CONTRA a ordem alfabética: "Aaa" vem antes de
// "Zzz" no dicionário, mas quem não tem grupo tem que vencer mesmo assim. Com
// os nomes do brief ("Zzz com grupo" / "Aaa sem grupo") um sort puramente
// alfabético — sem nenhuma lógica de pendência — já deixava "Aaa sem grupo"
// em primeiro por coincidência, e o teste passava mesmo sem a regra existir.
it("exercício sem grupo sobe ao topo marcado como pendente", async () => {
  await montar({ exercicios: [
    { nome: "Aaa com grupo", grupo: "Peito" },
    { nome: "Zzz sem grupo", grupo: null },
  ]});
  const itens = screen.getAllByRole("listitem");
  expect(itens[0]).toHaveTextContent("Zzz sem grupo");
  expect(itens[0]).toHaveTextContent(/sem grupo/i);
  // "fica" no singular: este cenário tem 1 pendente. O aviso concorda com a contagem.
  expect(screen.getByText(/fica fora da análise/i)).toBeInTheDocument();
});

it("exercício de catálogo não tem botão de editar nem excluir", async () => {
  await montar({ comCatalogo: true });
  const item = screen.getByRole("listitem", { name: "Supino reto com barra" });
  expect(within(item).queryByLabelText(/^editar /i)).not.toBeInTheDocument();
  expect(within(item).queryByLabelText(/^excluir /i)).not.toBeInTheDocument();
  // controle positivo: o item de catálogo aparece e está marcado como tal —
  // sem isto, os dois queryBy acima passariam mesmo se a lista estivesse vazia.
  expect(within(item).getByText(/catálogo/i)).toBeInTheDocument();
});

it("exercício do usuário tem editar e excluir", async () => {
  await montar({ exercicios: [{ nome: "Meu supino", grupo: "Peito" }] });
  const item = screen.getByRole("listitem", { name: /meu supino/i });
  // O rótulo nomeia o exercício: numa lista de vinte, "editar" sozinho não
  // diz a um leitor de tela o que está sendo editado.
  expect(within(item).getByLabelText("Editar Meu supino")).toBeInTheDocument();
  expect(within(item).getByLabelText("Excluir Meu supino")).toBeInTheDocument();
});

it("o formulário usa select de grupo, não texto livre", async () => {
  await montar();
  await userEvent.click(screen.getByRole("button", { name: /novo exercício/i }));
  const select = screen.getByLabelText(/grupo muscular/i);
  expect(select.tagName).toBe("SELECT");
  expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(
    expect.arrayContaining(["Peito", "Costas", "Quadríceps"]),
  );
});

it("cria exercício com o grupo escolhido", async () => {
  const { db } = await montar();
  await userEvent.click(screen.getByRole("button", { name: /novo exercício/i }));
  await userEvent.type(screen.getByLabelText(/^nome$/i), "Meu supino");
  await userEvent.selectOptions(screen.getByLabelText(/grupo muscular/i), "Peito");
  await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

  const rs = await db.execute(`SELECT e.nome AS n, mg.nome AS g FROM exercises e
    LEFT JOIN muscle_groups mg ON mg.id=e.grupo_id WHERE e.source='custom'`);
  expect(rs.rows[0]).toMatchObject({ n: "Meu supino", g: "Peito" });
});

it("avisa quando a exclusão é recusada por estar em uso", async () => {
  await montar({ exercicioEmUso: true });
  await userEvent.click(screen.getByLabelText(/^excluir /i));
  await userEvent.click(await screen.findByRole("button", { name: /^excluir$/i }));
  expect(await screen.findByText(/está em uso/i)).toBeInTheDocument();
});

/* ══ a biblioteca com 170 exercícios ══════════════════════════════════════
   Com 12 itens a lista era o conteúdo. Com 170 ela é um monte de palha, e
   achar "rosca scott" rolando é pior do que não ter catálogo nenhum. */

it("a busca filtra por nome, sem acento e sem caixa", async () => {
  await montar({ comCatalogo: true });
  await userEvent.type(screen.getByLabelText(/buscar exercício/i), "agachamento");
  expect(screen.getByRole("listitem", { name: "Agachamento livre" })).toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: "Supino reto com barra" })).not.toBeInTheDocument();
});

/** Ninguém procura "Supino reto com barra" na academia: procura "supino". */
it("a busca acha pelo apelido, não só pelo nome de catálogo", async () => {
  await montar({ comCatalogo: true });
  await userEvent.type(screen.getByLabelText(/buscar exercício/i), "bench");
  expect(screen.getByRole("listitem", { name: "Supino reto com barra" })).toBeInTheDocument();
});

it("o filtro de grupo mostra só os daquele grupo", async () => {
  await montar({ comCatalogo: true });
  await userEvent.selectOptions(screen.getByLabelText(/filtrar por grupo/i), "Peito");
  expect(screen.getByRole("listitem", { name: "Supino reto com barra" })).toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: "Agachamento livre" })).not.toBeInTheDocument();
});

it("busca sem resultado se explica em vez de mostrar lista vazia", async () => {
  await montar({ comCatalogo: true });
  await userEvent.type(screen.getByLabelText(/buscar exercício/i), "zzzzzz");
  expect(screen.getByText(/nenhum exercício encontrado/i)).toBeInTheDocument();
});

it("tocar num exercício abre a ficha dele", async () => {
  await montar({ comCatalogo: true });
  await userEvent.click(screen.getByRole("button", { name: "Ver ficha de Supino reto com barra" }));
  expect(await screen.findByRole("img", { name: /trabalha peito/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /youtube/i })).toBeInTheDocument();
});

/* ══ o formulário ═════════════════════════════════════════════════════════ */

it("cadastrar um cardio próprio grava equipamento e MET", async () => {
  const { db } = await montar();
  await userEvent.click(screen.getByRole("button", { name: /novo exercício/i }));
  await userEvent.type(screen.getByLabelText(/^nome$/i), "Escada");
  await userEvent.selectOptions(screen.getByLabelText(/equipamento/i), "cardio");
  const met = await screen.findByLabelText(/met/i);
  await userEvent.clear(met);
  await userEvent.type(met, "9");
  await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

  await waitFor(async () => {
    const rs = await db.execute("SELECT nome, equipamento, met FROM exercises WHERE source='custom'");
    expect(rs.rows[0]).toMatchObject({ nome: "Escada", equipamento: "cardio", met: 9 });
  });
});

it("grava a execução, os apelidos e os músculos secundários", async () => {
  const { db } = await montar();
  await userEvent.click(screen.getByRole("button", { name: /novo exercício/i }));
  await userEvent.type(screen.getByLabelText(/^nome$/i), "Minha remada");
  await userEvent.selectOptions(screen.getByLabelText(/grupo muscular/i), "Costas");
  await userEvent.click(screen.getByRole("button", { name: /também trabalha bíceps/i }));
  await userEvent.type(screen.getByLabelText(/outros nomes/i), "remadinha");
  await userEvent.type(screen.getByLabelText(/como executar/i), "Puxe até o umbigo.");
  await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

  await waitFor(async () => {
    const rs = await db.execute(
      "SELECT musculos_secundarios AS sec, aliases, instrucoes FROM exercises WHERE source='custom'",
    );
    expect(rs.rows[0]).toMatchObject({
      sec: "Bíceps",
      aliases: "remadinha",
      instrucoes: "Puxe até o umbigo.",
    });
  });
});


/**
 * Cardio não tem grupo muscular por design, e é `source='catalogo'` — ou seja,
 * o usuário nem pode editar. Contá-lo como pendente produzia um aviso
 * permanente ("12 exercícios estão sem grupo muscular") sem ação possível.
 */
it("cardio do catálogo não é contado como pendente de grupo", async () => {
  await montar({ comCardio: true });
  expect(screen.queryByText(/fora da análise/i)).not.toBeInTheDocument();
  // controle positivo: o item de cardio está na lista, só não é uma pendência.
  expect(screen.getByRole("listitem", { name: /bicicleta/i })).toBeInTheDocument();
});

it("cardio na lista se identifica como cardio, não como \"sem grupo muscular\"", async () => {
  await montar({ comCardio: true });
  const item = screen.getByRole("listitem", { name: /bicicleta/i });
  expect(within(item).getByText(/cardio/i)).toBeInTheDocument();
  expect(within(item).queryByText(/sem grupo muscular/i)).not.toBeInTheDocument();
});

it("ainda avisa sobre exercício do usuário sem grupo", async () => {
  await montar({ comCardio: true, exercicios: [{ nome: "Zzz sem grupo", grupo: null }] });
  expect(screen.getByText(/fica fora da análise/i)).toBeInTheDocument();
});
