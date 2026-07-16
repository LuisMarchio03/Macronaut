import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { DbProvider } from "../../lib/db-context";
import { NovaSerieForm } from "./nova-serie-form";
import { seedMuscleGroups } from "../../repositories/muscle-groups";
import { seedExercicios } from "../../repositories/exercises";
import { createSession, addSet } from "../../repositories/workouts";
import type { WorkoutSet } from "../../domain/types";

const HOJE = "2026-07-16";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await seedMuscleGroups(db);
  await seedExercicios(db);
});

async function idDoExercicio(nome: string): Promise<number> {
  const rs = await db.execute({ sql: "SELECT id FROM exercises WHERE nome=?", args: [nome] });
  return rs.rows[0].id as number;
}

/** Monta o form sobre uma sessão de hoje. `comHistorico` semeia 3×10 @ 40kg RIR 2 em 12/07. */
async function montar(opts: { comHistorico?: boolean } = {}) {
  const sessao = await createSession(db, 1, { data: HOJE, nome: null });

  if (opts.comHistorico) {
    const exId = await idDoExercicio("Supino reto com barra");
    const antiga = await createSession(db, 1, { data: "2026-07-12", nome: null });
    for (let i = 1; i <= 3; i++) {
      await addSet(db, 1, {
        session_id: antiga.id, exercise_id: exId, ordem: i,
        reps: 10, peso_kg: 40, tipo: "valida", rir: 2, nota: null,
      });
    }
  }

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <NovaSerieForm sessionId={sessao.id} data={HOJE} sets={[]} />
      </DbProvider>
    </QueryClientProvider>,
  );
  return { db, sessao };
}

async function selecionarExercicio(nome: string) {
  await userEvent.type(screen.getByRole("combobox"), nome.slice(0, 10));
  await userEvent.click(await screen.findByText(nome));
}

/**
 * Monta o form com uma sessão de hoje e semeia, em 2026-07-12, uma sessão de
 * "Supino reto com barra" com exatamente as séries passadas (na ordem dada).
 * Usado pelos testes do painel "anterior" que precisam controlar RIR/peso/reps
 * série a série (o `comHistorico` de `montar()` só cobre o caso uniforme).
 */
async function montarComSetsHistoricos(
  setsHistoricos: { reps: number; peso_kg: number; rir: number | null }[],
) {
  const sessao = await createSession(db, 1, { data: HOJE, nome: null });
  const exId = await idDoExercicio("Supino reto com barra");
  const antiga = await createSession(db, 1, { data: "2026-07-12", nome: null });
  for (let i = 0; i < setsHistoricos.length; i++) {
    await addSet(db, 1, {
      session_id: antiga.id, exercise_id: exId, ordem: i + 1,
      reps: setsHistoricos[i].reps, peso_kg: setsHistoricos[i].peso_kg,
      tipo: "valida", rir: setsHistoricos[i].rir, nota: null,
    });
  }

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <NovaSerieForm sessionId={sessao.id} data={HOJE} sets={[]} />
      </DbProvider>
    </QueryClientProvider>,
  );
  return { sessao, exId };
}

it("pré-seleciona tipo Válida e nenhum RIR", async () => {
  await montar();
  expect(screen.getByRole("button", { name: /válida/i })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /aquec/i })).toHaveAttribute("aria-pressed", "false");
  for (const r of ["0", "1", "2", "3", "4+"]) {
    expect(screen.getByRole("button", { name: `RIR ${r}` })).toHaveAttribute("aria-pressed", "false");
  }
});

it("clicar num RIR seleciona; clicar de novo limpa", async () => {
  await montar();
  const rir2 = screen.getByRole("button", { name: "RIR 2" });
  await userEvent.click(rir2);
  expect(rir2).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(rir2);
  expect(rir2).toHaveAttribute("aria-pressed", "false");
});

it("mostra 'sem histórico' quando o exercício nunca foi feito", async () => {
  await montar();
  await selecionarExercicio("Supino reto com barra");
  expect(await screen.findByText(/sem histórico/i)).toBeInTheDocument();
});

it("mostra o painel anterior com data, séries e RIR", async () => {
  // semear: sessão em 2026-07-12 com 3x10 @ 40kg RIR 2 no exercício 1
  await montar({ comHistorico: true });
  await selecionarExercicio("Supino reto com barra");
  expect(await screen.findByText(/12\/07/)).toBeInTheDocument();
  expect(screen.getByText(/3×10 @ 40 kg/)).toBeInTheDocument();
  expect(screen.getByText(/RIR 2/)).toBeInTheDocument();
});

it("grava a série com tipo e rir escolhidos", async () => {
  const { db } = await montar();
  await selecionarExercicio("Supino reto com barra");
  await userEvent.clear(screen.getByLabelText(/reps/i));
  await userEvent.type(screen.getByLabelText(/reps/i), "8");
  await userEvent.type(screen.getByLabelText(/peso/i), "60");
  await userEvent.click(screen.getByRole("button", { name: /aquec/i }));
  await userEvent.click(screen.getByRole("button", { name: "RIR 3" }));
  await userEvent.click(screen.getByRole("button", { name: /\+ série/i }));

  const rs = await db.execute("SELECT reps, peso_kg, tipo, rir FROM workout_sets");
  expect(rs.rows[0]).toMatchObject({ reps: 8, peso_kg: 60, tipo: "aquecimento", rir: 3 });
});

it("não deixa gravar sem exercício selecionado", async () => {
  await montar();
  expect(screen.getByRole("button", { name: /\+ série/i })).toBeDisabled();
});

it("grava RIR 0 como 0, não como null", async () => {
  const { db } = await montar();
  await selecionarExercicio("Supino reto com barra");
  await userEvent.click(screen.getByRole("button", { name: "RIR 0" }));
  await userEvent.click(screen.getByRole("button", { name: /\+ série/i }));

  const rs = await db.execute("SELECT rir FROM workout_sets");
  expect(rs.rows[0].rir).toBe(0);
});

// Fix 1 — o painel "anterior" precisa mostrar o RIR da ÚLTIMA série efetiva
// (a mais próxima da falha), não da primeira. Com RIR 3/1/0 (padrão comum:
// primeira série mais fresca), mostrar "RIR 3" faria o usuário achar que
// sobrava reserva quando na verdade fechou a última série na falha.
it("mostra o RIR da última série efetiva do histórico, não da primeira", async () => {
  await montarComSetsHistoricos([
    { reps: 10, peso_kg: 40, rir: 3 },
    { reps: 10, peso_kg: 40, rir: 1 },
    { reps: 10, peso_kg: 40, rir: 0 },
  ]);
  await selecionarExercicio("Supino reto com barra");
  expect(await screen.findByText(/RIR 0/)).toBeInTheDocument();
  expect(screen.queryByText(/RIR 3/)).not.toBeInTheDocument();
});

// Fix 2 — peso variando (ex.: drop set) não pode virar "@ variado": o painel
// existe para informar a carga, e "variado" não diz nada. Detalha por série.
it("detalha peso por série no painel quando ele varia entre as séries (drop set)", async () => {
  await montarComSetsHistoricos([
    { reps: 10, peso_kg: 40, rir: null },
    { reps: 10, peso_kg: 40, rir: null },
    { reps: 12, peso_kg: 25, rir: null },
  ]);
  await selecionarExercicio("Supino reto com barra");
  expect(await screen.findByText(/10,10,12 @ 40\/40\/25 kg/)).toBeInTheDocument();
  expect(screen.queryByText(/variado/)).not.toBeInTheDocument();
});

// Fix 3 — RIR 4 significa "4 ou mais" por spec; o painel deve rotular "4+" em
// vez do número cru, como já faz o resto da UI (chips de RIR e lista de séries).
it("mostra RIR 4+ no painel anterior quando a última série do histórico foi RIR 4", async () => {
  await montarComSetsHistoricos([{ reps: 10, peso_kg: 40, rir: 4 }]);
  await selecionarExercicio("Supino reto com barra");
  expect(await screen.findByText(/RIR 4\+/)).toBeInTheDocument();
});

// Fix 5 — `ordem` é por exercício, calculada a partir das séries já no form,
// não um contador global. `ultimaVezExercicio` ordena por `ws.ordem`, então um
// valor errado aqui bagunça o próprio painel "anterior" nas próximas sessões.
it("calcula a ordem da nova série por exercício, ignorando séries de outros exercícios", async () => {
  const idX = await idDoExercicio("Supino reto com barra");
  const idY = await idDoExercicio("Puxada frontal na polia");
  const sessao = await createSession(db, 1, { data: HOJE, nome: null });

  const base = { session_id: sessao.id, tipo: "valida" as const, rir: null, nota: null, created_at: "" };
  const setsExistentes: WorkoutSet[] = [
    { id: 1, exercise_id: idX, ordem: 1, reps: 10, peso_kg: 40, ...base },
    { id: 2, exercise_id: idX, ordem: 2, reps: 10, peso_kg: 40, ...base },
    { id: 3, exercise_id: idY, ordem: 1, reps: 8, peso_kg: 20, ...base },
  ];

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <NovaSerieForm sessionId={sessao.id} data={HOJE} sets={setsExistentes} />
      </DbProvider>
    </QueryClientProvider>,
  );

  await selecionarExercicio("Supino reto com barra");
  await userEvent.click(screen.getByRole("button", { name: /\+ série/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT COUNT(*) AS n FROM workout_sets");
    expect(rs.rows[0].n).toBe(1);
  });

  await userEvent.clear(screen.getByRole("combobox"));
  await selecionarExercicio("Puxada frontal na polia");
  await userEvent.click(screen.getByRole("button", { name: /\+ série/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT COUNT(*) AS n FROM workout_sets");
    expect(rs.rows[0].n).toBe(2);
  });

  const rs = await db.execute("SELECT exercise_id, ordem FROM workout_sets ORDER BY id");
  expect(rs.rows[0]).toMatchObject({ exercise_id: idX, ordem: 3 });
  expect(rs.rows[1]).toMatchObject({ exercise_id: idY, ordem: 2 });
});

// Fix 6 — apagar a série do meio (ordem 2) deixa um buraco: 1, 3. `length+1`
// contaria 2 séries restantes e devolveria 3, colidindo com a que já existe.
// `MAX(ordem)+1` fecha o buraco corretamente e devolve 4.
it("usa MAX(ordem)+1 ao calcular a ordem da nova série, mesmo com buraco na sequência", async () => {
  const idX = await idDoExercicio("Supino reto com barra");
  const sessao = await createSession(db, 1, { data: HOJE, nome: null });

  const base = { session_id: sessao.id, tipo: "valida" as const, rir: null, nota: null, created_at: "" };
  const setsExistentes: WorkoutSet[] = [
    { id: 1, exercise_id: idX, ordem: 1, reps: 10, peso_kg: 40, ...base },
    { id: 2, exercise_id: idX, ordem: 3, reps: 10, peso_kg: 40, ...base },
  ];

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <NovaSerieForm sessionId={sessao.id} data={HOJE} sets={setsExistentes} />
      </DbProvider>
    </QueryClientProvider>,
  );

  await selecionarExercicio("Supino reto com barra");
  await userEvent.click(screen.getByRole("button", { name: /\+ série/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT COUNT(*) AS n FROM workout_sets");
    expect(rs.rows[0].n).toBe(1);
  });

  const rs = await db.execute("SELECT ordem FROM workout_sets");
  expect(rs.rows[0]).toMatchObject({ ordem: 4 });
});

// Fix 7 — depois de gravar, exercício/reps/peso/tipo continuam preenchidos e
// só a nota limpa. É o que permite logar série após série na academia sem
// re-selecionar o exercício a cada série.
it("mantém exercício, reps, peso e tipo depois de gravar; só a nota limpa", async () => {
  const { db } = await montar();
  await selecionarExercicio("Supino reto com barra");
  await userEvent.clear(screen.getByLabelText(/reps/i));
  await userEvent.type(screen.getByLabelText(/reps/i), "8");
  await userEvent.clear(screen.getByLabelText(/peso/i));
  await userEvent.type(screen.getByLabelText(/peso/i), "60");
  await userEvent.click(screen.getByRole("button", { name: /aquec/i }));
  await userEvent.click(screen.getByRole("button", { name: "+ nota" }));
  await userEvent.type(screen.getByLabelText(/^nota$/i), "boa execução");

  await userEvent.click(screen.getByRole("button", { name: /\+ série/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT COUNT(*) AS n FROM workout_sets");
    expect(rs.rows[0].n).toBe(1);
  });

  expect(screen.getByRole("combobox")).toHaveValue("Supino reto com barra");
  expect(screen.getByLabelText(/reps/i)).toHaveValue("8");
  expect(screen.getByLabelText(/peso/i)).toHaveValue("60");
  expect(screen.getByRole("button", { name: /aquec/i })).toHaveAttribute("aria-pressed", "true");
  // nota volta a ficar escondida atrás de "+ nota" — sinal de que foi limpa
  expect(screen.getByRole("button", { name: "+ nota" })).toBeInTheDocument();
  expect(screen.queryByLabelText(/^nota$/i)).not.toBeInTheDocument();

  // Mordida direta: grava uma SEGUNDA série sem tocar na nota e afirma no
  // banco que ela não herdou o texto da primeira. Isso prova a consequência
  // real de `nota` ter sido de fato limpo no estado — não só escondido na UI.
  // Se `setNota("")` sumir de `nova-serie-form.tsx` (mantendo só
  // `setMostrarNota(false)`), os asserts de UI acima continuam verdes, mas
  // este aqui pega: a segunda série gravaria "boa execução" de novo.
  await userEvent.click(screen.getByRole("button", { name: /\+ série/i }));
  await waitFor(async () => {
    const rs = await db.execute("SELECT COUNT(*) AS n FROM workout_sets");
    expect(rs.rows[0].n).toBe(2);
  });

  const rs = await db.execute("SELECT nota FROM workout_sets ORDER BY id");
  expect(rs.rows[0].nota).toBe("boa execução");
  expect(rs.rows[1].nota).toBeNull();
});
