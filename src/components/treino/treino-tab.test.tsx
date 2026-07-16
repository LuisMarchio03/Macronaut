import { it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { DbProvider } from "../../lib/db-context";
import { DataProvider } from "../../lib/data-context";
import { DateNav } from "../date-nav";
import { TreinoTab } from "./treino-tab";
import {
  getSessionByDate, listSetsBySession, createSession, addSet, updateSession,
} from "../../repositories/workouts";
import * as workoutsRepo from "../../repositories/workouts";
import { seedMuscleGroups } from "../../repositories/muscle-groups";
import { hoje } from "../../lib/date";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await seedMuscleGroups(db);
  await db.execute({ sql: "INSERT INTO exercises (nome, created_at) VALUES ('Supino', ?)", args: [new Date().toISOString()] });
});

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><DataProvider><TreinoTab /></DataProvider></DbProvider>
    </QueryClientProvider>,
  );
}

// Inclui o `DateNav` de verdade para poder trocar de dia pela UI — necessário
// pro teste de resync de `NotaSessao` (Gap 2 abaixo), que depende do
// cache-hit real do TanStack Query ao voltar pra um dia já visitado.
function renderTabComNav() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <DataProvider>
          <DateNav />
          <TreinoTab />
        </DataProvider>
      </DbProvider>
    </QueryClientProvider>,
  );
}

function diaAnterior(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

it("inicia treino do dia e loga uma série", async () => {
  const user = userEvent.setup();
  renderTab();
  await user.click(await screen.findByRole("button", { name: /iniciar treino/i }));
  await waitFor(async () => expect(await getSessionByDate(db, 1, hoje())).not.toBeNull());

  // escolher exercício, reps e peso, adicionar série
  await user.type(await screen.findByRole("combobox"), "Supino");
  await user.click(await screen.findByText("Supino"));
  await user.clear(screen.getByLabelText(/reps/i));
  await user.type(screen.getByLabelText(/reps/i), "10");
  await user.clear(screen.getByLabelText(/peso/i));
  await user.type(screen.getByLabelText(/peso/i), "80");
  await user.click(screen.getByRole("button", { name: /\+ s[ée]rie/i }));

  await waitFor(async () => {
    const s = await getSessionByDate(db, 1, hoje());
    expect(await listSetsBySession(db, 1, s!.id)).toHaveLength(1);
  });
});

it("editar série inline altera reps/peso e persiste", async () => {
  const user = userEvent.setup();
  const s = await createSession(db, 1, { data: hoje(), nome: null });
  await addSet(db, 1, { session_id: s.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null });
  renderTab();

  await user.click(await screen.findByText(/10 reps × 40 kg/i));
  // match exato: evita colidir com o Label "Reps"/"Peso (kg)" do formulário "Nova série"
  const reps = screen.getByLabelText("reps");
  await user.clear(reps);
  await user.type(reps, "8");
  const peso = screen.getByLabelText("peso");
  await user.clear(peso);
  await user.type(peso, "50");
  await user.click(screen.getByRole("button", { name: /confirmar/i }));

  await waitFor(() => expect(screen.getByText(/8 reps × 50 kg/i)).toBeInTheDocument());

  const sets = await listSetsBySession(db, 1, s.id);
  expect(sets).toHaveLength(1);
  expect(sets[0]).toMatchObject({ reps: 8, peso_kg: 50 });
});

async function semearSessaoCom(created_ats: string[]) {
  const s = await createSession(db, 1, { data: hoje(), nome: null });
  for (const [i, ts] of created_ats.entries()) {
    await db.execute({
      sql: `INSERT INTO workout_sets
              (user_id, session_id, exercise_id, ordem, reps, peso_kg, tipo, rir, nota, created_at)
            VALUES (1, ?, 1, ?, 10, 40, 'valida', NULL, NULL, ?)`,
      args: [s.id, i + 1, ts],
    });
  }
  return s;
}

it("mostra a duração estimada quando há mais de uma série", async () => {
  await semearSessaoCom(["2026-07-16T10:00:00.000Z", "2026-07-16T10:30:00.000Z"]);
  renderTab();
  expect(await screen.findByText(/~30 min/)).toBeInTheDocument();
});

it("não mostra duração com uma série só", async () => {
  await semearSessaoCom(["2026-07-16T10:00:00.000Z"]);
  renderTab();
  await screen.findByText(/10 reps × 40 kg/i); // espera a sessão renderizar
  expect(screen.queryByText(/min/)).not.toBeInTheDocument();
});

it("aquecimento não entra na contagem de séries do painel do exercício", async () => {
  const s = await createSession(db, 1, { data: hoje(), nome: null });
  await addSet(db, 1, { session_id: s.id, exercise_id: 1, ordem: 1, reps: 10, peso_kg: 20, tipo: "aquecimento", rir: null, nota: null });
  await addSet(db, 1, { session_id: s.id, exercise_id: 1, ordem: 2, reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null });
  await addSet(db, 1, { session_id: s.id, exercise_id: 1, ordem: 3, reps: 8, peso_kg: 45, tipo: "valida", rir: null, nota: null });
  renderTab();

  expect(await screen.findByText("2 séries")).toBeInTheDocument();
});

// Fix 6 — NotaSessao (treino-tab.tsx:19-47) não tinha nenhum teste. Cobre os
// 3 comportamentos do brief: grava no blur, não grava se nada mudou, e mostra
// a nota já salva ao montar.

it("digitar na nota do treino grava só no blur — não a cada tecla", async () => {
  const user = userEvent.setup();
  await createSession(db, 1, { data: hoje(), nome: null });
  const spy = vi.spyOn(workoutsRepo, "updateSession");
  renderTab();

  const campo = await screen.findByLabelText(/nota do treino/i);
  await user.type(campo, "ombro incomodou, peguei leve");
  // Enquanto digita (antes do blur), nada deve ter sido gravado ainda.
  expect(spy).not.toHaveBeenCalled();

  fireEvent.blur(campo);

  await waitFor(async () => {
    const sessao = await getSessionByDate(db, 1, hoje());
    expect(sessao?.nota).toBe("ombro incomodou, peguei leve");
  });
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

it("sair da nota do treino sem alterar o texto não dispara mutação", async () => {
  const user = userEvent.setup();
  const s = await createSession(db, 1, { data: hoje(), nome: null });
  await updateSession(db, 1, s.id, { nota: "nota existente" });

  const spy = vi.spyOn(workoutsRepo, "updateSession");
  renderTab();

  const campo = await screen.findByLabelText(/nota do treino/i);
  await waitFor(() => expect(campo).toHaveValue("nota existente"));
  await user.click(campo);
  fireEvent.blur(campo);

  // Dá tempo pra uma mutação indevida rodar, se o guard sumir.
  await new Promise((r) => setTimeout(r, 50));
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

it("mostra a nota do treino já salva ao montar", async () => {
  const s = await createSession(db, 1, { data: hoje(), nome: null });
  await updateSession(db, 1, s.id, { nota: "pump bom hoje" });
  renderTab();

  expect(await screen.findByDisplayValue("pump bom hoje")).toBeInTheDocument();
});

// Gap 2 — o `useEffect` de resync de `NotaSessao` (treino-tab.tsx:30) é
// mutation-dead nos 3 testes de Fix 6 acima: todos leem o valor pelo
// inicializador `useState(valor ?? "")` no mount, nunca pelo efeito. O
// caminho real que só o efeito cobre: `useSessionByDate` com cache-hit
// devolve a sessão sem passar por `undefined`, então `NotaSessao` NÃO
// desmonta ao voltar pra um dia já visitado — o campo ficaria com a nota do
// dia errado até um blur gravar ela por cima da nota certa (corrupção de
// dado). Testamos pela porta da frente (`TreinoTab` + `DateNav` de verdade)
// pra exercitar o cache-hit de fato, sem mockar o react-query.
it("ressincroniza a nota do treino ao voltar pra um dia já visitado, sem desmontar o campo (cache-hit)", async () => {
  const hojeIso = hoje();
  const ontemIso = diaAnterior(hojeIso);

  const sHoje = await createSession(db, 1, { data: hojeIso, nome: null });
  await updateSession(db, 1, sHoje.id, { nota: "nota de hoje" });
  const sOntem = await createSession(db, 1, { data: ontemIso, nome: null });
  await updateSession(db, 1, sOntem.id, { nota: "nota de ontem" });

  const user = userEvent.setup();
  renderTabComNav();

  // 1) monta em "hoje" — popula o cache de "hoje" no QueryClient.
  expect(await screen.findByDisplayValue("nota de hoje")).toBeInTheDocument();

  // 2) vai pro dia anterior — primeira visita a "ontem", sem cache: passa por
  // `undefined` e remonta `NotaSessao` fresca (não exercita o efeito ainda).
  await user.click(screen.getByRole("button", { name: /dia anterior/i }));
  expect(await screen.findByDisplayValue("nota de ontem")).toBeInTheDocument();

  // 3) volta pra "hoje" — já está em cache (passo 1): `useSessionByDate`
  // entrega a sessão sem passar por `undefined`, então `NotaSessao` continua
  // montada (mesma instância, só props novas). Só o `useEffect` de
  // treino-tab.tsx:30 pode atualizar `texto` pro valor certo aqui.
  await user.click(screen.getByRole("button", { name: /próximo dia/i }));
  expect(await screen.findByDisplayValue("nota de hoje")).toBeInTheDocument();
  expect(screen.queryByDisplayValue("nota de ontem")).not.toBeInTheDocument();
});
