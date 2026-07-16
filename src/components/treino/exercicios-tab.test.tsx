import { it, expect, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { DbProvider } from "../../lib/db-context";
import { ExerciciosTab } from "./exercicios-tab";
import { listExercises, seedExercicios } from "../../repositories/exercises";
import { seedMuscleGroups } from "../../repositories/muscle-groups";
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
  exercicioEmUso?: boolean;
} = {}) {
  await seedMuscleGroups(db);
  if (opts.comCatalogo) await seedExercicios(db);
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
      <DbProvider client={db}><ExerciciosTab /></DbProvider>
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
  await user.type(screen.getByLabelText(/nome/i), "Supino");
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
  const item = screen.getByRole("listitem", { name: /supino reto com barra/i });
  expect(within(item).queryByLabelText("editar")).not.toBeInTheDocument();
  expect(within(item).queryByLabelText("excluir")).not.toBeInTheDocument();
  // controle positivo: o item de catálogo aparece e está marcado como tal —
  // sem isto, os dois queryBy acima passariam mesmo se a lista estivesse vazia.
  expect(within(item).getByText(/catálogo/i)).toBeInTheDocument();
});

it("exercício do usuário tem editar e excluir", async () => {
  await montar({ exercicios: [{ nome: "Meu supino", grupo: "Peito" }] });
  const item = screen.getByRole("listitem", { name: /meu supino/i });
  expect(within(item).getByLabelText("editar")).toBeInTheDocument();
  expect(within(item).getByLabelText("excluir")).toBeInTheDocument();
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
  await userEvent.type(screen.getByLabelText(/nome/i), "Meu supino");
  await userEvent.selectOptions(screen.getByLabelText(/grupo muscular/i), "Peito");
  await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

  const rs = await db.execute(`SELECT e.nome AS n, mg.nome AS g FROM exercises e
    LEFT JOIN muscle_groups mg ON mg.id=e.grupo_id WHERE e.source='custom'`);
  expect(rs.rows[0]).toMatchObject({ n: "Meu supino", g: "Peito" });
});

it("avisa quando a exclusão é recusada por estar em uso", async () => {
  await montar({ exercicioEmUso: true });
  await userEvent.click(screen.getByLabelText("excluir"));
  expect(await screen.findByText(/está em uso/i)).toBeInTheDocument();
});
