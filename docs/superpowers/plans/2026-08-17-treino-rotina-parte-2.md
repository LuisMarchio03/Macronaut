# Treino por rotina semanal — Implementation Plan (parte 2 de 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continuação de `2026-08-17-treino-rotina.md`. Cobre o repositório da sessão materializada e os hooks que as telas consomem.

**Architecture:** `repositories/sessao.ts` é o único lugar que sabe transformar prescrição em linhas de `session_plan_sets` e série confirmada em linha de `workout_sets`. Os hooks são wrappers finos do TanStack Query, sem regra.

**Tech Stack:** Turso/libSQL, TanStack Query 5, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-17-treino-rotina-design.md`

**Parte 1 (Tasks 1–7):** `docs/superpowers/plans/2026-08-17-treino-rotina.md`
**Parte 3 (Tasks 10–13):** `docs/superpowers/plans/2026-08-17-treino-rotina-parte-3.md`

## Global Constraints

Idênticas às da parte 1 — ver `docs/superpowers/plans/2026-08-17-treino-rotina.md`. Em resumo: português nos símbolos e na tela, inglês no schema; SQL só em `src/repositories/`; `src/domain/` puro; toda query filtra por `user_id`; toque mínimo 44px; sem `DROP TABLE`; rodar com `npm test -- --run`.

---

### Task 8: `repositories/sessao.ts`

**Files:**
- Create: `src/repositories/sessao.ts`
- Test: `src/repositories/sessao.test.ts`

**Interfaces:**
- Consumes: `type SeriePlanejada` de `src/domain/prescricao.ts`; `type TipoSerie` de `src/domain/types.ts`; `createSession` de `src/repositories/workouts.ts`.
- Produces:
  - `interface PlanoSerie { id: number; session_id: number; routine_exercise_id: number | null; exercise_id: number; nome: string; ordem: number; serie_ordem: number; peso_kg: number; reps_alvo: number; reps_min: number | null; tipo: TipoSerie; amrap: boolean; pct: number | null; descanso_s: number | null; set_id: number | null; reps_feitas: number | null; peso_feito_kg: number | null }`
  - `interface ItemPlanejado { routine_exercise_id: number | null; exercise_id: number; nome: string; descanso_s: number | null; series: SeriePlanejada[] }`
  - `iniciarSessao(db, userId, entrada: { data: string; nome: string | null; itens: ItemPlanejado[] }): Promise<number>` — devolve o `session_id`.
  - `getPlano(db, userId, sessionId): Promise<PlanoSerie[]>`
  - `registrarSerie(db, userId, planId, v: { reps: number; peso_kg: number; tipo: TipoSerie; rir: number | null; nota: string | null }): Promise<void>`
  - `desfazerSerie(db, userId, planId): Promise<void>`
  - `adicionarAoPlano(db, userId, sessionId, item: ItemPlanejado): Promise<void>`
  - `sessaoEmAndamento(db, userId, data): Promise<{ session_id: number; nome: string | null; total: number; feitas: number } | null>`
  - `marcasAmrap(db, userId, exerciseId): Promise<{ peso_kg: number; reps: number }[]>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/repositories/sessao.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  adicionarAoPlano,
  desfazerSerie,
  getPlano,
  iniciarSessao,
  marcasAmrap,
  registrarSerie,
  sessaoEmAndamento,
  type ItemPlanejado,
} from "./sessao";
import { listSetsBySession } from "./workouts";
import { planejar } from "../domain/prescricao";

const USER = 1;
const OUTRO = 2;
let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
    args: [nome, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

function item(exercise_id: number, peso = 40, nome = "Exercício"): ItemPlanejado {
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

beforeEach(async () => {
  db = await createTestDb();
});

describe("iniciarSessao", () => {
  it("materializa o plano com ordem global contínua e serie_ordem por exercício", async () => {
    const supino = await exercicio("Supino");
    const crucifixo = await exercicio("Crucifixo");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17",
      nome: "Peito",
      itens: [item(supino), item(crucifixo, 15)],
    });

    const plano = await getPlano(db, USER, sid);
    expect(plano).toHaveLength(6);
    expect(plano.map((p) => p.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plano.map((p) => p.serie_ordem)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(plano.map((p) => p.nome)).toEqual(
      ["Supino", "Supino", "Supino", "Crucifixo", "Crucifixo", "Crucifixo"],
    );
    expect(plano[0].peso_kg).toBe(40);
    expect(plano[3].peso_kg).toBe(15);
    expect(plano[0].reps_alvo).toBe(12);
    expect(plano[0].descanso_s).toBe(90);
  });

  // O ponto do desenho: enquanto nada foi confirmado, o registro está vazio.
  it("não escreve nada em workout_sets ao materializar", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
  });

  it("o plano de um usuário não vaza para outro", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    expect(await getPlano(db, OUTRO, sid)).toHaveLength(0);
  });
});

describe("registrarSerie", () => {
  it("cria a série em workout_sets e liga o plano a ela", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);

    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: 1, nota: null,
    });

    const sets = await listSetsBySession(db, USER, sid);
    expect(sets).toHaveLength(1);
    expect(sets[0].reps).toBe(12);
    expect(sets[0].peso_kg).toBe(40);
    expect(sets[0].rir).toBe(1);
    // workout_sets.ordem é a posição DENTRO do exercício.
    expect(sets[0].ordem).toBe(1);

    const depois = await getPlano(db, USER, sid);
    expect(depois[0].set_id).toBe(sets[0].id);
    expect(depois[0].reps_feitas).toBe(12);
    expect(depois[1].set_id).toBeNull();
  });

  it("registra o que foi feito, não o que foi planejado", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);

    await registrarSerie(db, USER, plano[0].id, {
      reps: 9, peso_kg: 37.5, tipo: "falha", rir: 0, nota: "ombro doeu",
    });

    const [set] = await listSetsBySession(db, USER, sid);
    expect(set.reps).toBe(9);
    expect(set.peso_kg).toBe(37.5);
    expect(set.tipo).toBe("falha");
    expect(set.nota).toBe("ombro doeu");

    const [linha] = await getPlano(db, USER, sid);
    expect(linha.peso_kg).toBe(40); // o prescrito não muda
    expect(linha.peso_feito_kg).toBe(37.5);
  });

  it("guarda percentual e AMRAP quando a série é de 5/3/1", async () => {
    const agacho = await exercicio("Agachamento");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17",
      nome: "Perna",
      itens: [{
        routine_exercise_id: null,
        exercise_id: agacho,
        nome: "Agachamento",
        descanso_s: 180,
        series: planejar({ tipo: "531", tm_kg: 100, parte: "inferior", incremento_kg: 2.5 }, []),
      }],
    });
    const plano = await getPlano(db, USER, sid);
    const amrap = plano.find((p) => p.amrap)!;
    expect(amrap.pct).toBe(85);

    await registrarSerie(db, USER, amrap.id, {
      reps: 8, peso_kg: 85, tipo: "valida", rir: null, nota: null,
    });
    expect(await marcasAmrap(db, USER, agacho)).toEqual([{ peso_kg: 85, reps: 8 }]);
  });

  it("um usuário não registra série no plano do outro", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, OUTRO, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });
    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
  });
});

describe("desfazerSerie", () => {
  it("apaga a série e desfaz o elo", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    await desfazerSerie(db, USER, plano[0].id);

    expect(await listSetsBySession(db, USER, sid)).toHaveLength(0);
    expect((await getPlano(db, USER, sid))[0].set_id).toBeNull();
  });

  it("desfazer uma série nunca registrada não faz nada", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await desfazerSerie(db, USER, plano[0].id);
    expect(await getPlano(db, USER, sid)).toHaveLength(3);
  });
});

describe("adicionarAoPlano", () => {
  it("acrescenta um exercício avulso no fim, sem routine_exercise_id", async () => {
    const supino = await exercicio("Supino");
    const rosca = await exercicio("Rosca direta");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });

    await adicionarAoPlano(db, USER, sid, item(rosca, 12));

    const plano = await getPlano(db, USER, sid);
    expect(plano).toHaveLength(6);
    expect(plano.map((p) => p.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plano[3].nome).toBe("Rosca direta");
    expect(plano[3].serie_ordem).toBe(1);
    expect(plano[3].routine_exercise_id).toBeNull();
  });
});

describe("sessaoEmAndamento", () => {
  it("não há sessão num dia sem sessão", async () => {
    expect(await sessaoEmAndamento(db, USER, "2026-08-17")).toBeNull();
  });

  it("conta quantas séries do plano já foram feitas", async () => {
    const supino = await exercicio("Supino");
    const sid = await iniciarSessao(db, USER, {
      data: "2026-08-17", nome: "Peito", itens: [item(supino)],
    });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    const em = await sessaoEmAndamento(db, USER, "2026-08-17");
    expect(em).toEqual({ session_id: sid, nome: "Peito", total: 3, feitas: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/repositories/sessao.test.ts`
Expected: FAIL — não resolve `./sessao`.

- [ ] **Step 3: Implementar**

Criar `src/repositories/sessao.ts`:

```ts
import type { Client, Row } from "@libsql/client";
import type { SeriePlanejada } from "../domain/prescricao";
import type { TipoSerie } from "../domain/types";
import { createSession } from "./workouts";

/**
 * A sessão materializada: o plano congelado no banco no momento em que o
 * treino começou.
 *
 * O plano mora em `session_plan_sets`, separado de `workout_sets`, porque
 * `workout_sets` significa "o que foi feito" para meia dúzia de consultas que
 * não sabem que existe plano. Uma linha de plano sem `set_id` é, com precisão,
 * uma série que você não fez.
 */

export interface PlanoSerie {
  id: number;
  session_id: number;
  routine_exercise_id: number | null;
  exercise_id: number;
  nome: string;
  /** Posição na sessão inteira. */
  ordem: number;
  /** Posição dentro do exercício — é o que vai para `workout_sets.ordem`. */
  serie_ordem: number;
  peso_kg: number;
  reps_alvo: number;
  reps_min: number | null;
  tipo: TipoSerie;
  amrap: boolean;
  pct: number | null;
  descanso_s: number | null;
  set_id: number | null;
  /** O que foi efetivamente feito, quando já foi. */
  reps_feitas: number | null;
  peso_feito_kg: number | null;
}

export interface ItemPlanejado {
  routine_exercise_id: number | null;
  exercise_id: number;
  /** O nome do exercício, para quem monta o item não obrigar quem exibe a
   *  fazer um segundo join só para escrever "Supino reto" na tela. */
  nome: string;
  descanso_s: number | null;
  series: SeriePlanejada[];
}

/** Dono da sessão, para o WHERE das escritas no plano. */
const PLANOS_DO_USUARIO = `
  SELECT p.id FROM session_plan_sets p WHERE p.user_id = ?`;

function mapPlano(r: Row): PlanoSerie {
  return {
    id: r.id as number,
    session_id: r.session_id as number,
    routine_exercise_id: (r.routine_exercise_id as number | null) ?? null,
    exercise_id: r.exercise_id as number,
    nome: (r.exercicio_nome as string | null) ?? "?",
    ordem: r.ordem as number,
    serie_ordem: r.serie_ordem as number,
    peso_kg: r.peso_kg as number,
    reps_alvo: r.reps_alvo as number,
    reps_min: (r.reps_min as number | null) ?? null,
    tipo: r.tipo as TipoSerie,
    amrap: Number(r.amrap) === 1,
    pct: (r.pct as number | null) ?? null,
    descanso_s: (r.descanso_s as number | null) ?? null,
    set_id: (r.set_id as number | null) ?? null,
    reps_feitas: (r.reps_feitas as number | null) ?? null,
    peso_feito_kg: (r.peso_feito_kg as number | null) ?? null,
  };
}

/** As linhas de plano de um item, dado o ponto onde a ordem global está. */
function linhasDoItem(
  userId: number,
  sessionId: number,
  item: ItemPlanejado,
  ordemInicial: number,
) {
  return item.series.map((s, i) => ({
    sql: `INSERT INTO session_plan_sets
            (user_id, session_id, routine_exercise_id, exercise_id, ordem, serie_ordem,
             peso_kg, reps_alvo, reps_min, tipo, amrap, pct, descanso_s)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId, sessionId, item.routine_exercise_id, item.exercise_id,
      ordemInicial + i, s.ordem,
      s.peso_kg, s.reps_alvo, s.reps_min, s.tipo, s.amrap ? 1 : 0, s.pct,
      item.descanso_s,
    ] as (number | string | null)[],
  }));
}

export async function iniciarSessao(
  db: Client,
  userId: number,
  entrada: { data: string; nome: string | null; itens: ItemPlanejado[] },
): Promise<number> {
  const sessao = await createSession(db, userId, { data: entrada.data, nome: entrada.nome });

  let ordem = 1;
  const comandos = entrada.itens.flatMap((item) => {
    const linhas = linhasDoItem(userId, sessao.id, item, ordem);
    ordem += item.series.length;
    return linhas;
  });
  if (comandos.length > 0) await db.batch(comandos, "write");

  return sessao.id;
}

export async function adicionarAoPlano(
  db: Client,
  userId: number,
  sessionId: number,
  item: ItemPlanejado,
): Promise<void> {
  // MAX(ordem)+1, não COUNT+1: nada apaga linha de plano hoje, mas COUNT+1
  // colidiria em silêncio no dia em que algo apagar.
  const rs = await db.execute({
    sql: `SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima
          FROM session_plan_sets WHERE user_id = ? AND session_id = ?`,
    args: [userId, sessionId],
  });
  const comandos = linhasDoItem(userId, sessionId, item, rs.rows[0].proxima as number);
  if (comandos.length > 0) await db.batch(comandos, "write");
}

export async function getPlano(
  db: Client,
  userId: number,
  sessionId: number,
): Promise<PlanoSerie[]> {
  const rs = await db.execute({
    sql: `SELECT p.*, e.nome AS exercicio_nome,
                 ws.reps AS reps_feitas, ws.peso_kg AS peso_feito_kg
          FROM session_plan_sets p
          LEFT JOIN exercises e   ON e.id  = p.exercise_id
          LEFT JOIN workout_sets ws ON ws.id = p.set_id
          WHERE p.user_id = ? AND p.session_id = ?
          ORDER BY p.ordem`,
    args: [userId, sessionId],
  });
  return rs.rows.map(mapPlano);
}

export async function registrarSerie(
  db: Client,
  userId: number,
  planId: number,
  v: { reps: number; peso_kg: number; tipo: TipoSerie; rir: number | null; nota: string | null },
): Promise<void> {
  const rs = await db.execute({
    sql: `SELECT session_id, exercise_id, serie_ordem, pct, amrap
          FROM session_plan_sets WHERE id = ? AND user_id = ?`,
    args: [planId, userId],
  });
  if (!rs.rows.length) return;
  const linha = rs.rows[0];

  const ins = await db.execute({
    sql: `INSERT INTO workout_sets
            (user_id, session_id, exercise_id, ordem, reps, peso_kg, tipo, rir, nota,
             prescribed_pct, amrap, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId,
      linha.session_id as number,
      linha.exercise_id as number,
      linha.serie_ordem as number,
      v.reps, v.peso_kg, v.tipo, v.rir, v.nota,
      (linha.pct as number | null) ?? null,
      Number(linha.amrap) === 1 ? 1 : 0,
      new Date().toISOString(),
    ],
  });

  await db.execute({
    sql: `UPDATE session_plan_sets SET set_id = ? WHERE id = ? AND user_id = ?`,
    args: [Number(ins.lastInsertRowid), planId, userId],
  });
}

export async function desfazerSerie(db: Client, userId: number, planId: number): Promise<void> {
  const rs = await db.execute({
    sql: `SELECT set_id FROM session_plan_sets WHERE id = ? AND user_id = ?`,
    args: [planId, userId],
  });
  const setId = rs.rows.length ? ((rs.rows[0].set_id as number | null) ?? null) : null;
  if (setId === null) return;

  await db.batch(
    [
      { sql: "DELETE FROM workout_sets WHERE id = ? AND user_id = ?", args: [setId, userId] },
      {
        sql: `UPDATE session_plan_sets SET set_id = NULL WHERE id = ? AND id IN (${PLANOS_DO_USUARIO})`,
        args: [planId, userId],
      },
    ],
    "write",
  );
}

export async function sessaoEmAndamento(
  db: Client,
  userId: number,
  data: string,
): Promise<{ session_id: number; nome: string | null; total: number; feitas: number } | null> {
  const rs = await db.execute({
    sql: `SELECT s.id AS session_id, s.nome AS nome,
                 COUNT(p.id) AS total,
                 SUM(CASE WHEN p.set_id IS NOT NULL THEN 1 ELSE 0 END) AS feitas
          FROM workout_sessions s
          JOIN session_plan_sets p ON p.session_id = s.id
          WHERE s.user_id = ? AND s.data = ?
          GROUP BY s.id
          ORDER BY s.created_at DESC
          LIMIT 1`,
    args: [userId, data],
  });
  if (!rs.rows.length) return null;
  const r = rs.rows[0];
  return {
    session_id: r.session_id as number,
    nome: (r.nome as string | null) ?? null,
    total: Number(r.total),
    feitas: Number(r.feitas ?? 0),
  };
}

/**
 * Marcas de AMRAP do exercício — o recorde de repetições num peso.
 *
 * Veio de `repositories/programa.ts` sem mudança: a pergunta continua sendo
 * sobre `workout_sets`, só o dono do arquivo mudou.
 */
export async function marcasAmrap(
  db: Client,
  userId: number,
  exerciseId: number,
): Promise<{ peso_kg: number; reps: number }[]> {
  const rs = await db.execute({
    sql: `SELECT peso_kg, reps FROM workout_sets
          WHERE user_id=? AND exercise_id=? AND amrap=1
          ORDER BY id`,
    args: [userId, exerciseId],
  });
  return rs.rows.map((r) => ({ peso_kg: r.peso_kg as number, reps: r.reps as number }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- --run src/repositories/sessao.test.ts`
Expected: PASS, os 13 casos.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/sessao.ts src/repositories/sessao.test.ts
git commit -m "feat(treino): sessão materializada, com plano separado do registro"
```

---

### Task 9: Hooks `use-rotina.ts` e `use-sessao.ts`

**Files:**
- Create: `src/hooks/use-rotina.ts`
- Create: `src/hooks/use-sessao.ts`
- Modify: `src/hooks/use-workouts.ts`
- Test: `src/hooks/use-rotina.test.tsx`

**Interfaces:**
- Consumes: tudo o que as Tasks 6, 7 e 8 produziram; `useDb`/`useUserId` de `src/lib/db-context`; `criarWrapper` de `test/helpers/query-wrapper`.
- Produces:
  - `use-rotina.ts`: `useRotinaAtiva()`, `useDiasDaRotina(rotina)`, `useExerciciosDoDia(dayId)`, `useExerciciosDaRotina(rotina)`, `useCriarRotina()`, `useSalvarDia()`, `useRemoverDia()`, `useAdicionarExercicio()`, `useAtualizarExercicio()`, `useRemoverExercicio()`, `useReordenarExercicios()`
  - `use-sessao.ts`: `useSessaoEmAndamento(data)`, `usePlano(sessionId)`, `useIniciarSessao()`, `useRegistrarSerie(sessionId)`, `useDesfazerSerie(sessionId)`, `useAdicionarAoPlano(sessionId)`, `useMarcasAmrap(exerciseId)`
  - `use-workouts.ts`: `useHistoricoExercicio(exerciseId, antesDe, limite?)`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/hooks/use-rotina.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { useRotinaAtiva, useCriarRotina, useDiasDaRotina, useSalvarDia } from "./use-rotina";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
});

describe("use-rotina", () => {
  it("sem rotina, useRotinaAtiva responde null", async () => {
    const { result } = renderHook(() => useRotinaAtiva(), { wrapper: criarWrapper(db) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("criar a rotina invalida a consulta e ela reaparece", async () => {
    const wrapper = criarWrapper(db);
    const { result } = renderHook(
      () => ({ ativa: useRotinaAtiva(), criar: useCriarRotina() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.ativa.isSuccess).toBe(true));

    await result.current.criar.mutateAsync("Minha rotina");
    await waitFor(() => expect(result.current.ativa.data?.nome).toBe("Minha rotina"));
  });

  it("salvar um dia aparece na lista de dias", async () => {
    const wrapper = criarWrapper(db);
    const { result } = renderHook(
      () => {
        const ativa = useRotinaAtiva();
        return {
          ativa,
          criar: useCriarRotina(),
          dias: useDiasDaRotina(ativa.data),
          salvar: useSalvarDia(),
        };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.ativa.isSuccess).toBe(true));
    const rotina = await result.current.criar.mutateAsync("R");

    await result.current.salvar.mutateAsync({
      routineId: rotina.id, dia_semana: 1, nome: "Peito",
    });
    await waitFor(() => expect(result.current.dias.data?.[0]?.nome).toBe("Peito"));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/hooks/use-rotina.test.tsx`
Expected: FAIL — não resolve `./use-rotina`.

- [ ] **Step 3: Implementar**

Criar `src/hooks/use-rotina.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  adicionarExercicio,
  atualizarExercicio,
  criarRotina,
  getRotinaAtiva,
  listDias,
  listExercicios,
  listExerciciosDaRotina,
  removerDia,
  removerExercicio,
  reordenarExercicios,
  salvarDia,
  type ExercicioRotinaInput,
  type Rotina,
} from "../repositories/rotina";

const CHAVE = {
  raiz: ["rotina"] as const,
  ativa: ["rotina", "ativa"] as const,
  dias: (id?: number) => ["rotina", "dias", id] as const,
  exercicios: (dayId?: number) => ["rotina", "exercicios", dayId] as const,
  todos: (id?: number) => ["rotina", "todos", id] as const,
};

export function useRotinaAtiva() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: CHAVE.ativa, queryFn: () => getRotinaAtiva(db, userId) });
}

export function useDiasDaRotina(rotina: Rotina | null | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.dias(rotina?.id),
    queryFn: () => listDias(db, userId, rotina!.id),
    enabled: rotina != null,
  });
}

export function useExerciciosDoDia(dayId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.exercicios(dayId),
    queryFn: () => listExercicios(db, userId, dayId!),
    enabled: dayId != null,
  });
}

export function useExerciciosDaRotina(rotina: Rotina | null | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: CHAVE.todos(rotina?.id),
    queryFn: () => listExerciciosDaRotina(db, userId, rotina!.id),
    enabled: rotina != null,
  });
}

/** Invalida a raiz: qualquer escrita na rotina pode mexer em dias, exercícios
 *  e no que o hub mostra — invalidar por partes deixaria uma tela mentindo. */
function useEscritaNaRotina<TVars, TDados>(fn: (v: TVars) => Promise<TDados>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE.raiz }),
  });
}

export function useCriarRotina() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((nome: string) => criarRotina(db, userId, nome));
}

export function useSalvarDia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((v: { routineId: number; dia_semana: number; nome: string }) =>
    salvarDia(db, userId, v.routineId, v.dia_semana, v.nome),
  );
}

export function useRemoverDia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((dayId: number) => removerDia(db, userId, dayId));
}

export function useAdicionarExercicio() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((v: { dayId: number; entrada: ExercicioRotinaInput }) =>
    adicionarExercicio(db, userId, v.dayId, v.entrada),
  );
}

export function useAtualizarExercicio() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((v: { id: number; entrada: ExercicioRotinaInput }) =>
    atualizarExercicio(db, userId, v.id, v.entrada),
  );
}

export function useRemoverExercicio() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((id: number) => removerExercicio(db, userId, id));
}

export function useReordenarExercicios() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaRotina((v: { dayId: number; ids: number[] }) =>
    reordenarExercicios(db, userId, v.dayId, v.ids),
  );
}
```

Criar `src/hooks/use-sessao.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import type { TipoSerie } from "../domain/types";
import {
  adicionarAoPlano,
  desfazerSerie,
  getPlano,
  iniciarSessao,
  marcasAmrap,
  registrarSerie,
  sessaoEmAndamento,
  type ItemPlanejado,
} from "../repositories/sessao";

export function useSessaoEmAndamento(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "andamento", data],
    queryFn: () => sessaoEmAndamento(db, userId, data),
  });
}

export function usePlano(sessionId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "plano", sessionId],
    queryFn: () => getPlano(db, userId, sessionId!),
    enabled: sessionId != null,
  });
}

export function useMarcasAmrap(exerciseId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "amrap", exerciseId],
    queryFn: () => marcasAmrap(db, userId, exerciseId!),
    enabled: exerciseId != null,
  });
}

/**
 * Uma escrita na sessão mexe no plano, no histórico e na progressão de uma vez.
 * `sessions`, `session-sets`, `sets-exercise` e `ultima-vez` são as chaves que
 * `use-workouts` já usa — invalidá-las aqui é o que mantém histórico e gráficos
 * verdadeiros sem a tela saber que elas existem.
 */
function useEscritaNaSessao<TVars, TDados>(fn: (v: TVars) => Promise<TDados>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const chave of [
        ["sessao"], ["sessions"], ["session"], ["session-sets"],
        ["sets-exercise"], ["ultima-vez"], ["historico-exercicio"],
      ]) {
        qc.invalidateQueries({ queryKey: chave });
      }
    },
  });
}

export function useIniciarSessao() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao(
    (v: { data: string; nome: string | null; itens: ItemPlanejado[] }) =>
      iniciarSessao(db, userId, v),
  );
}

export function useRegistrarSerie() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao(
    (v: {
      planId: number;
      reps: number;
      peso_kg: number;
      tipo: TipoSerie;
      rir: number | null;
      nota: string | null;
    }) =>
      registrarSerie(db, userId, v.planId, {
        reps: v.reps, peso_kg: v.peso_kg, tipo: v.tipo, rir: v.rir, nota: v.nota,
      }),
  );
}

export function useDesfazerSerie() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((planId: number) => desfazerSerie(db, userId, planId));
}

export function useAdicionarAoPlano() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((v: { sessionId: number; item: ItemPlanejado }) =>
    adicionarAoPlano(db, userId, v.sessionId, v.item),
  );
}
```

Em `src/hooks/use-workouts.ts`, acrescentar `historicoExercicio` ao import de `../repositories/workouts` e o hook no fim:

```ts
export function useHistoricoExercicio(
  exerciseId: number | undefined,
  antesDe: string,
  limite = 3,
) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["historico-exercicio", userId, exerciseId, antesDe, limite],
    queryFn: () => historicoExercicio(db, userId, exerciseId as number, antesDe, limite),
    enabled: exerciseId != null,
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- --run src/hooks/use-rotina.test.tsx`
Expected: PASS.

Depois: `npx tsc --noEmit` — deve compilar exceto pelos arquivos que a Task 13 apaga (`programa.ts`, `use-programa.ts`, `treino-programa.tsx`, e os testes deles), que já falham desde a Task 5. Se aparecer erro em outro arquivo, corrigir agora.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-rotina.ts src/hooks/use-sessao.ts src/hooks/use-workouts.ts src/hooks/use-rotina.test.tsx
git commit -m "feat(treino): hooks da rotina e da sessão"
```
