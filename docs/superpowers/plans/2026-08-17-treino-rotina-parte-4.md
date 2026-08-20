# Treino por rotina semanal — Implementation Plan (parte 4 de 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O hub `/treino` reescrito em torno de "o que é hoje", e a remoção do que o 5/3/1-como-espinha deixou para trás.

**Architecture:** Montar o plano de um dia exige cruzar a rotina com o histórico de cada exercício — orquestração de dados, não regra. Ela mora em `repositories/sessao.ts` (`montarPlanoDoDia`), não na tela nem no domínio.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Vitest 4 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-17-treino-rotina-design.md`

**Partes:** 1 = Tasks 1–7, 2 = Tasks 8–9, 3 = Tasks 10–11 (mesmo diretório).

## Global Constraints

Idênticas às da parte 1. Em resumo: português nos símbolos e na tela, inglês no schema; SQL só em `src/repositories/`; `src/domain/` puro; toda query filtra por `user_id`; toque mínimo 44px; sem `DROP TABLE`; rodar com `npm test -- --run`.

---

### Task 12: `/treino` — o hub em torno de hoje

**Files:**
- Modify: `src/repositories/sessao.ts`
- Modify: `src/hooks/use-sessao.ts`
- Rewrite: `src/pages/treino.tsx`
- Test: `src/repositories/sessao.test.ts`
- Rewrite: `src/pages/treino.test.tsx`

**Interfaces:**
- Consumes: `listExercicios` de `src/repositories/rotina`; `historicoExercicio` de `src/repositories/workouts`; `planejar` de `src/domain/prescricao`; `treinoDoDia`, `proximoTreino` de `src/domain/prescricao`; `diaSemana` de `src/lib/date`.
- Produces:
  - `montarPlanoDoDia(db, userId, dayId: number, data: string): Promise<ItemPlanejado[]>` em `src/repositories/sessao.ts`
  - `usePlanoDoDia(dayId: number | undefined, data: string)` em `src/hooks/use-sessao.ts`
  - `Treino` reescrita em `src/pages/treino.tsx`

- [ ] **Step 1: Escrever o teste que falha (repositório)**

Adicionar a `src/repositories/sessao.test.ts` — incluir `montarPlanoDoDia` no import de `./sessao` e `criarRotina`, `salvarDia`, `adicionarExercicio` no de `./rotina`, além de `createSession`/`addSet` de `./workouts`:

```ts
describe("montarPlanoDoDia", () => {
  it("planeja cada exercício do dia na ordem da rotina", async () => {
    const supino = await exercicio("Supino");
    const crucifixo = await exercicio("Crucifixo");
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const re1 = await adicionarExercicio(db, USER, d.id, {
      exercise_id: supino, prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 120,
    });
    await adicionarExercicio(db, USER, d.id, {
      exercise_id: crucifixo, prescricao: "fixa", series: 4, reps_min: null, reps_max: 15,
      peso_kg: 12, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 60,
    });

    const itens = await montarPlanoDoDia(db, USER, d.id, "2026-08-17");
    expect(itens).toHaveLength(2);
    expect(itens[0].exercise_id).toBe(supino);
    expect(itens[0].routine_exercise_id).toBe(re1);
    expect(itens[0].descanso_s).toBe(120);
    expect(itens[0].series).toHaveLength(3);
    expect(itens[0].series[0].peso_kg).toBe(40);
    expect(itens[1].series).toHaveLength(4);
    expect(itens[1].series[0].reps_alvo).toBe(15);
  });

  // O ponto do desenho: a carga de hoje sai do que foi feito, não da rotina.
  it("a dupla progressão sobe a carga a partir do histórico", async () => {
    const supino = await exercicio("Supino");
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    await adicionarExercicio(db, USER, d.id, {
      exercise_id: supino, prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
    });

    const s = await createSession(db, USER, { data: "2026-08-10", nome: null });
    for (const ordem of [1, 2, 3]) {
      await addSet(db, USER, {
        session_id: s.id, exercise_id: supino, ordem,
        reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null,
      });
    }

    const itens = await montarPlanoDoDia(db, USER, d.id, "2026-08-17");
    expect(itens[0].series[0].peso_kg).toBe(42.5);
  });

  it("dia sem exercício devolve lista vazia", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    expect(await montarPlanoDoDia(db, USER, d.id, "2026-08-17")).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/repositories/sessao.test.ts`
Expected: FAIL — `montarPlanoDoDia is not a function`.

- [ ] **Step 3: Implementar `montarPlanoDoDia`**

Em `src/repositories/sessao.ts`, acrescentar aos imports:

```ts
import { planejar, type Prescricao } from "../domain/prescricao";
import { listExercicios, type ExercicioRotina } from "./rotina";
import { historicoExercicio } from "./workouts";
```

E no fim do arquivo:

```ts
/** A prescrição guardada na rotina, no formato que o domínio entende. */
function prescricaoDe(e: ExercicioRotina): Prescricao {
  if (e.prescricao === "531") {
    return {
      tipo: "531",
      tm_kg: e.tm_kg ?? 0,
      parte: e.parte ?? "superior",
      incremento_kg: e.incremento_kg,
    };
  }
  if (e.prescricao === "fixa") {
    return { tipo: "fixa", series: e.series, reps: e.reps_max ?? 10, peso_kg: e.peso_kg ?? 0 };
  }
  return {
    tipo: "dupla",
    series: e.series,
    reps_min: e.reps_min ?? 8,
    reps_max: e.reps_max ?? 12,
    peso_inicial_kg: e.peso_kg ?? 0,
    incremento_kg: e.incremento_kg,
  };
}

/**
 * O treino de um dia da rotina, já com as cargas de hoje.
 *
 * Cruza a rotina com o histórico de cada exercício — orquestração de dados, não
 * regra: a conta em si é `planejar`, que continua pura. Fica aqui e não na tela
 * porque são N consultas por dia, e uma tela orquestrando N consultas vira uma
 * tela que sabe SQL.
 */
export async function montarPlanoDoDia(
  db: Client,
  userId: number,
  dayId: number,
  data: string,
): Promise<ItemPlanejado[]> {
  const exercicios = await listExercicios(db, userId, dayId);
  return Promise.all(
    exercicios.map(async (e) => ({
      routine_exercise_id: e.id,
      exercise_id: e.exercise_id,
      nome: e.nome,
      descanso_s: e.descanso_s,
      series: planejar(prescricaoDe(e), await historicoExercicio(db, userId, e.exercise_id, data)),
    })),
  );
}
```

E em `src/hooks/use-sessao.ts`, acrescentar `montarPlanoDoDia` ao import e o hook:

```ts
export function usePlanoDoDia(dayId: number | undefined, data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "plano-do-dia", dayId, data],
    queryFn: () => montarPlanoDoDia(db, userId, dayId!, data),
    enabled: dayId != null,
  });
}
```

- [ ] **Step 4: Rodar o repositório e ver passar**

Run: `npm test -- --run src/repositories/sessao.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever o teste da tela**

Substituir `src/pages/treino.test.tsx` por:

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { Treino } from "./treino";
import { criarRotina, salvarDia, adicionarExercicio } from "../repositories/rotina";
import { diaSemana, hoje } from "../lib/date";

let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
    args: [nome, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <Treino />
      </MemoryRouter>
    </Wrapper>,
  );
}

/** O dia da semana de hoje, para o teste montar a rotina no dia certo sem
 *  depender de quando ele roda. */
const HOJE = diaSemana(hoje());
const AMANHA = (HOJE + 1) % 7;

beforeEach(async () => {
  db = await createTestDb();
});

describe("Treino — o hub", () => {
  it("sem rotina, convida a montar uma", async () => {
    montar();
    expect(await screen.findByText(/nenhuma rotina/i)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /montar rotina/i })).toBeInTheDocument();
  });

  it("em dia de treino, mostra o treino de hoje com as cargas", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, HOJE, "Peito e tríceps");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Supino reto"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
    });
    montar();

    expect(await screen.findByText("Peito e tríceps")).toBeInTheDocument();
    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect(await screen.findByText(/3 × 12 × 40 kg/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /começar treino/i })).toBeInTheDocument();
  });

  it("em dia de descanso, mostra qual é o próximo treino", async () => {
    const r = await criarRotina(db, 1, "R");
    await salvarDia(db, 1, r.id, AMANHA, "Costas e bíceps");
    montar();

    expect(await screen.findByText(/descanso/i)).toBeInTheDocument();
    expect(await screen.findByText(/costas e bíceps/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /treinar mesmo assim/i })).toBeInTheDocument();
  });

  it("começar o treino materializa a sessão", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, HOJE, "Peito");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Supino reto"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /começar treino/i }));

    await waitFor(async () => {
      const rs = await db.execute("SELECT COUNT(*) AS n FROM session_plan_sets");
      expect(Number(rs.rows[0].n)).toBe(3);
    });
  });

  it("com sessão em andamento, o card vira retomar", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, HOJE, "Peito");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Supino reto"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /começar treino/i }));
    expect(await screen.findByRole("link", { name: /retomar treino/i })).toBeInTheDocument();
    expect(await screen.findByText(/0 de 3 séries/i)).toBeInTheDocument();
  });

  it("os atalhos apontam para rotina, progressão, histórico, exercícios e cardio", async () => {
    montar();
    for (const [nome, destino] of [
      [/rotina/i, "/treino/rotina"],
      [/progressão/i, "/treino/progressao"],
      [/histórico/i, "/treino/historico"],
      [/exercícios/i, "/treino/exercicios"],
      [/cardio/i, "/treino/cardio"],
    ] as const) {
      const link = await screen.findByRole("link", { name: nome });
      expect(link).toHaveAttribute("href", destino);
    }
  });
});
```

- [ ] **Step 6: Implementar a tela**

Substituir `src/pages/treino.tsx` inteiro por:

```tsx
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays, ChevronRight, Dumbbell, HeartPulse, History, Play, TrendingUp,
} from "lucide-react";
import { Card, CardRow } from "@/components/ui/card";
import { Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton";
import { useDiasDaRotina, useRotinaAtiva } from "@/hooks/use-rotina";
import { useIniciarSessao, usePlanoDoDia, useSessaoEmAndamento } from "@/hooks/use-sessao";
import { useListSessions } from "@/hooks/use-workouts";
import { proximoTreino, treinoDoDia } from "@/domain/prescricao";
import { dataPorExtenso, dataRelativa, diaSemana, hoje } from "@/lib/date";
import { DIAS_DA_SEMANA } from "./treino-rotina";

const ATALHOS = [
  { to: "/treino/rotina", icone: CalendarDays, label: "Rotina", sub: "O que você treina em cada dia" },
  { to: "/treino/progressao", icone: TrendingUp, label: "Progressão", sub: "Gráficos e recordes" },
  { to: "/treino/historico", icone: History, label: "Histórico", sub: "Sessões anteriores" },
  { to: "/treino/exercicios", icone: Dumbbell, label: "Exercícios", sub: "Biblioteca" },
  { to: "/treino/cardio", icone: HeartPulse, label: "Cardio", sub: "Corrida, bike, caminhada" },
];

export function Treino() {
  const navigate = useNavigate();
  const data = hoje();
  const hojeSemana = diaSemana(data);

  const { data: rotina, isLoading } = useRotinaAtiva();
  const { data: dias = [] } = useDiasDaRotina(rotina);
  const dia = treinoDoDia(dias, hojeSemana);
  const proximo = proximoTreino(dias, hojeSemana);

  const { data: plano = [] } = usePlanoDoDia(dia?.id, data);
  const { data: emAndamento } = useSessaoEmAndamento(data);
  const { data: recentes = [] } = useListSessions();
  const iniciar = useIniciarSessao();

  function comecar(itens = plano) {
    iniciar.mutate(
      { data, nome: dia?.nome ?? "Treino livre", itens },
      { onSuccess: (id) => navigate(`/treino/sessao?s=${id}`) },
    );
  }

  if (isLoading) {
    return (
      <Page>
        <SkeletonCard />
        <SkeletonList rows={3} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader eyebrow={dataPorExtenso(data)} title="Treino" />

      {!rotina ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="Nenhuma rotina configurada"
            description="Diga ao app o que você treina em cada dia da semana. Depois é só abrir e seguir — a carga de cada exercício ele calcula sozinho, e sobe quando você bater a meta."
            action={<ButtonLink to="/treino/rotina">Montar rotina</ButtonLink>}
          />
        </Card>
      ) : emAndamento ? (
        <Card tone="primary">
          <p className="t-caption">Sessão em andamento</p>
          <h2 className="t-title mt-0.5">{emAndamento.nome ?? "Treino"}</h2>
          <p className="t-caption mt-1 tabular-nums">
            {emAndamento.feitas} de {emAndamento.total} séries
          </p>
          <ButtonLink to={`/treino/sessao?s=${emAndamento.session_id}`} block className="mt-4">
            <Play className="size-4" />
            Retomar treino
          </ButtonLink>
        </Card>
      ) : dia ? (
        <Card tone="primary">
          <p className="t-caption">{DIAS_DA_SEMANA[hojeSemana]}</p>
          <h2 className="t-title mt-0.5">{dia.nome}</h2>

          {plano.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {plano.map((item) => (
                <li
                  key={item.routine_exercise_id ?? item.exercise_id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">{item.nome}</span>
                  <span className="t-caption shrink-0 tabular-nums">
                    {item.series.length} × {item.series[0]?.reps_alvo} × {item.series[0]?.peso_kg} kg
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-caption mt-2">
              Este dia ainda não tem exercício. Adicione na rotina, ou comece e monte na hora.
            </p>
          )}

          <Button block className="mt-4" onClick={() => comecar()} disabled={iniciar.isPending}>
            <Play className="size-4" />
            Começar treino
          </Button>
        </Card>
      ) : (
        <Card>
          <p className="t-caption">{DIAS_DA_SEMANA[hojeSemana]}</p>
          <h2 className="t-title mt-0.5">Descanso</h2>
          {proximo ? (
            <p className="t-caption mt-1">
              Próximo: {DIAS_DA_SEMANA[proximo.dia_semana].toLowerCase()} · {proximo.nome}
            </p>
          ) : (
            <p className="t-caption mt-1">Sua rotina ainda não tem nenhum dia de treino.</p>
          )}
          <button
            type="button"
            onClick={() => comecar([])}
            disabled={iniciar.isPending}
            className="mt-3 min-h-11 text-[0.8125rem] font-medium text-primary"
          >
            Treinar mesmo assim
          </button>
        </Card>
      )}

      {recentes.length > 0 && (
        <div className="space-y-2">
          <SectionLabel
            action={
              <Link to="/treino/historico" className="text-[0.8125rem] font-medium text-primary">
                Ver tudo
              </Link>
            }
          >
            Últimas sessões
          </SectionLabel>
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {recentes.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <CardRow as={Link} to="/treino/historico">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.nome || "Sessão"}</span>
                      <span className="t-caption block">{dataRelativa(s.data)}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </CardRow>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Card padded={false}>
        <ul className="divide-y divide-border">
          {ATALHOS.map((a) => (
            <li key={a.to}>
              <CardRow as={Link} to={a.to}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <a.icone className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.label}</span>
                  <span className="t-caption block truncate">{a.sub}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </CardRow>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  );
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- --run src/pages/treino.test.tsx src/repositories/sessao.test.ts src/pages/treino-sessao.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/treino.tsx src/pages/treino.test.tsx src/repositories/sessao.ts src/repositories/sessao.test.ts src/hooks/use-sessao.ts src/pages/treino-sessao.test.tsx
git commit -m "feat(treino): hub em torno do treino de hoje"
```

---

### Task 13: Remover o que o 5/3/1-como-espinha deixou para trás

**Files:**
- Delete: `src/repositories/programa.ts`, `src/repositories/programa.test.ts`
- Delete: `src/hooks/use-programa.ts`
- Delete: `src/pages/treino-programa.tsx`
- Delete: `src/components/treino/treino-tab.tsx`, `treino-tab.test.tsx`
- Delete: `src/components/treino/nova-serie-form.tsx`, `nova-serie-form.test.tsx`
- Delete: `src/components/treino/lista-series-exercicio.tsx`
- Modify: `src/pages/treino-progressao.tsx`
- Modify: `src/App.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `useMarcasAmrap` de `src/hooks/use-sessao` (Task 9); `useExerciciosDaRotina`, `useRotinaAtiva` de `src/hooks/use-rotina`.
- Produces: nada novo. A suíte inteira volta a passar e `tsc --noEmit` fica limpo.

- [ ] **Step 1: Repontar `/treino/progressao` para a rotina**

`treino-progressao.tsx` lê os levantamentos do programa 5/3/1 para o card "Melhores marcas". A tela em si fica para a segunda rodada, mas a fonte dos dados muda agora — os exercícios com prescrição `531` na rotina.

Em `src/pages/treino-progressao.tsx`, trocar o import

```ts
import { useLevantamentos, useMarcasAmrap, useProgramaAtivo } from "@/hooks/use-programa";
```

por

```ts
import { useRotinaAtiva, useExerciciosDaRotina } from "@/hooks/use-rotina";
import { useMarcasAmrap } from "@/hooks/use-sessao";
```

e, dentro de `TreinoProgressao`, trocar

```ts
const { data: programa } = useProgramaAtivo();
const { data: lifts = [] } = useLevantamentos(programa);
```

por

```ts
const { data: rotina } = useRotinaAtiva();
const { data: todos = [] } = useExerciciosDaRotina(rotina);
// Recorde de repetições num peso é o que a série até a falha do 5/3/1 mede;
// exercício de dupla progressão não tem AMRAP e não teria o que mostrar.
const lifts = todos.filter((e) => e.prescricao === "531");
```

O corpo do `map` já usa `l.id`, `l.nome` e `l.exercise_id` — `ExercicioRotina` tem os três, então nada mais muda.

- [ ] **Step 2: Apagar os arquivos e a rota**

```bash
git rm src/repositories/programa.ts src/repositories/programa.test.ts \
       src/hooks/use-programa.ts \
       src/pages/treino-programa.tsx \
       src/components/treino/treino-tab.tsx src/components/treino/treino-tab.test.tsx \
       src/components/treino/nova-serie-form.tsx src/components/treino/nova-serie-form.test.tsx \
       src/components/treino/lista-series-exercicio.tsx
```

Em `src/App.tsx`, conferir que não sobrou import de `TreinoPrograma` nem rota `/treino/programa` (a Task 10 já trocou os dois; se algo escapou, remover agora).

- [ ] **Step 3: Rodar a suíte inteira**

Run: `npm test -- --run`
Expected: PASS, sem nenhum arquivo falhando. Se algum teste ainda importar o que foi apagado, é teste órfão do módulo antigo — apagar o arquivo de teste, não recriar o módulo.

Run: `npx tsc --noEmit`
Expected: sem erro.

- [ ] **Step 4: Atualizar o README**

Em `README.md`, na seção **Funcionalidades → Treino**, substituir os quatro itens por:

```markdown
**Treino**
- 📅 Rotina por dia da semana — segunda é peito, e o app sabe disso
- 🎯 Sessão guiada: as séries já vêm com carga e reps; um toque registra
- 📈 Dupla progressão: bateu o topo da faixa em todas as séries, a carga sobe
- 🏋️ 5/3/1 disponível como prescrição de qualquer exercício da rotina
- ⏱️ Cronômetro de descanso e sessão que sobrevive a fechar o app
- 🏃 Cardio com estimativa de kcal por MET e peso
```

Na tabela de pastas, acrescentar a linha:

```markdown
| `src/domain/prescricao.ts` | Como a carga de hoje é decidida: dupla progressão, carga fixa, 5/3/1. Puro. |
```

E atualizar o badge de contagem de testes com o número que `npm test -- --run` reportar.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(treino): remove o programa 5/3/1 como espinha do módulo"
```

---

## Self-review do plano

**Cobertura da spec, seção a seção:**

| Seção da spec | Task |
|---|---|
| Parte 1 — conceitos, plano ≠ registro | 5 (schema), 8 (repositório) |
| Parte 2 — contrato de `planejar` | 2 |
| Parte 2 — dupla progressão (a tabela inteira) | 2 |
| Parte 2 — 5/3/1 como prescrição, posição derivada de `n` | 3 |
| Parte 2 — `treinoDoDia` / `proximoTreino` / `diaSemana` | 1, 4 |
| Parte 3 — as quatro tabelas, os dois `ordem`, saída das tabelas do 5/3/1 | 5 |
| Parte 4 — hub nos quatro estados | 12 |
| Parte 4 — `/treino/rotina` e o sheet de prescrição | 10 |
| Parte 4 — `/treino/sessao`, ajuste, avanço automático, exercício avulso | 11 |
| Parte 4 — o que é apagado | 13 |
| Parte 5 — camadas e responsabilidades | 6, 7, 8, 9 |
| Parte 6 — a tabela de testes inteira | teste de cada task |

**Consistência de tipos verificada:** `SeriePlanejada` (Task 2) é consumida por `ItemPlanejado` (Task 8) e por `montarPlanoDoDia` (Task 12) com os mesmos campos. `ExercicioRotinaInput` (Task 6) é o que `SheetPrescricao` produz (Task 10) e o que `useAtualizarExercicio` aceita (Task 9). `PlanoSerie` (Task 8) é o que `LinhaSerie` e `SheetAjustarSerie` recebem (Task 11). `ItemPlanejado` já nasce com `nome` na Task 8, preenchido por `montarPlanoDoDia` (Task 12) e por quem adiciona exercício avulso (Task 11) — o card do hub não precisa de um segundo join só para escrever o nome.

**Risco conhecido, e por que não vira task própria:** as Tasks 5 a 12 deixam a suíte vermelha em `programa.test.ts`, `treino-sessao.test.tsx` e `treino.test.tsx` até a Task 13 fechar. É o custo de trocar a espinha do módulo; separar em duas espinhas convivendo seria mais caro e foi explicitamente descartado no brainstorming. Cada task ainda roda verde o **seu** arquivo de teste, que é o gate de cada uma.
