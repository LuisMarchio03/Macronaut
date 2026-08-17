# Treino por rotina semanal — Implementation Plan (parte 3 de 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As duas telas que o usuário toca: `/treino/rotina` (montar a rotina uma vez) e `/treino/sessao` (a tela da academia).

**Architecture:** Nenhuma conta nas telas — elas consomem `planejar` do domínio pelos hooks das Tasks 8 e 9. `/treino/sessao` fica fora do layout com barra de navegação, como já ficava.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Tailwind 4, Base UI (Sheet), Vitest 4 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-17-treino-rotina-design.md`

**Partes:** 1 = Tasks 1–7, 2 = Tasks 8–9, 4 = Tasks 12–13 (mesmo diretório).

## Global Constraints

Idênticas às da parte 1. Em resumo: português nos símbolos e na tela, inglês no schema; SQL só em `src/repositories/`; `src/domain/` puro; toda query filtra por `user_id`; toque mínimo 44px; cor só por token de `src/index.css`; rodar com `npm test -- --run`.

Componentes do design system disponíveis e suas assinaturas reais:
`Card({ tone, header, aside, footer, padded, className, bodyClassName, children })`,
`CardRow({ as, ...props })`,
`Page({ children })`, `PageHeader({ eyebrow, title, action, children })`, `SectionLabel({ action, children })`, `BackLink({ to, children })`,
`Button({ block, size, variant, ...ButtonPrimitive.Props })`, `ButtonLink({ to, block, ... })`,
`ChipGroup({ opcoes, valor, onChange, rotulo, desmarcavel, colunas })` — `opcoes: { valor, label, descricao? }[]`,
`Sheet` / `SheetContent({ side })` / `SheetHeader` / `SheetTitle` / `SheetFooter` / `SheetClose` (Base UI: `Sheet` recebe `open` e `onOpenChange`),
`Input`, `Label`, `EmptyState({ icon, title, description, action })`, `SkeletonCard`, `SkeletonList`.

Componentes de treino reaproveitados: `ExercicioAutocomplete({ id, exercicios, selecionado, onSelecionar })` e `CronometroDescanso({ chave })`.

---

### Task 10: `/treino/rotina` — montar a rotina

**Files:**
- Create: `src/pages/treino-rotina.tsx`
- Create: `src/components/treino/sheet-prescricao.tsx`
- Test: `src/pages/treino-rotina.test.tsx`

**Interfaces:**
- Consumes: todos os hooks de `src/hooks/use-rotina.ts`; `useExercises` de `src/hooks/use-exercises`; `type ExercicioRotina`, `type ExercicioRotinaInput` de `src/repositories/rotina`; `type TipoPrescricao` de `src/domain/prescricao`.
- Produces:
  - `TreinoRotina` (default export nomeado `export function TreinoRotina()`), montada em `/treino/rotina`.
  - `SheetPrescricao({ aberto, onFechar, exercicio, onSalvar })` em `src/components/treino/sheet-prescricao.tsx`, onde `exercicio: ExercicioRotina | null` e `onSalvar: (e: ExercicioRotinaInput) => void`.
  - `DIAS_DA_SEMANA: readonly string[]` exportado de `src/pages/treino-rotina.tsx` — `["Domingo", "Segunda", …]`, índice = `dia_semana`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/pages/treino-rotina.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { TreinoRotina } from "./treino-rotina";
import { criarRotina, salvarDia, adicionarExercicio, listExercicios } from "../repositories/rotina";

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
        <TreinoRotina />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("TreinoRotina", () => {
  it("sem rotina, convida a criar uma", async () => {
    montar();
    expect(await screen.findByRole("button", { name: /criar rotina/i })).toBeInTheDocument();
  });

  it("criada a rotina, lista os sete dias da semana", async () => {
    montar();
    await userEvent.click(await screen.findByRole("button", { name: /criar rotina/i }));
    for (const dia of ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]) {
      expect(await screen.findByText(dia)).toBeInTheDocument();
    }
  });

  it("um dia sem treino aparece como descanso", async () => {
    await criarRotina(db, 1, "R");
    montar();
    expect((await screen.findAllByText(/descanso/i)).length).toBe(7);
  });

  it("nomear um dia grava e o descanso some daquele dia", async () => {
    const r = await criarRotina(db, 1, "R");
    await salvarDia(db, 1, r.id, 1, "Peito e tríceps");
    montar();
    expect(await screen.findByText("Peito e tríceps")).toBeInTheDocument();
    expect((await screen.findAllByText(/descanso/i)).length).toBe(6);
  });

  it("mostra os exercícios do dia com séries, faixa de reps e carga", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, 1, "Peito");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Supino reto"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
    });
    montar();
    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect(await screen.findByText(/3 × 8–12/)).toBeInTheDocument();
    expect(await screen.findByText(/40 kg/)).toBeInTheDocument();
  });

  it("adicionar exercício grava com os padrões de dupla progressão", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, 1, "Peito");
    await exercicio("Supino reto");
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /adicionar exercício.*segunda/i }));
    const campo = await screen.findByLabelText(/exercício/i);
    await userEvent.type(campo, "Supino");
    await userEvent.click(await screen.findByRole("option", { name: /supino reto/i }));

    await waitFor(async () => {
      const lista = await listExercicios(db, 1, d.id);
      expect(lista).toHaveLength(1);
      expect(lista[0].prescricao).toBe("dupla");
      expect(lista[0].series).toBe(3);
      expect(lista[0].reps_min).toBe(8);
      expect(lista[0].reps_max).toBe(12);
      expect(lista[0].incremento_kg).toBe(2.5);
    });
  });

  it("o sheet de prescrição troca os campos ao escolher 5/3/1", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, 1, "Perna");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Agachamento"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 60, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /agachamento/i }));
    expect(await screen.findByLabelText(/peso de partida/i)).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: /^5\/3\/1$/i }));
    expect(await screen.findByLabelText(/training max/i)).toBeInTheDocument();
    // Pedir faixa de reps a quem escolheu 5/3/1 seria pedir um número que o
    // método já define.
    expect(screen.queryByLabelText(/peso de partida/i)).not.toBeInTheDocument();
  });

  it("remove um exercício do dia", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, 1, "Peito");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Crucifixo"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 12, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 60,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /remover crucifixo/i }));
    await waitFor(async () => expect(await listExercicios(db, 1, d.id)).toHaveLength(0));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/pages/treino-rotina.test.tsx`
Expected: FAIL — não resolve `./treino-rotina`.

- [ ] **Step 3: Implementar o sheet de prescrição**

Criar `src/components/treino/sheet-prescricao.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import type { TipoPrescricao } from "@/domain/prescricao";
import type { Parte } from "@/domain/531";
import type { ExercicioRotina, ExercicioRotinaInput } from "@/repositories/rotina";

const TIPOS = [
  { valor: "dupla" as const, label: "Dupla", descricao: "Dupla progressão" },
  { valor: "fixa" as const, label: "Fixa", descricao: "Carga fixa" },
  { valor: "531" as const, label: "5/3/1", descricao: "Método 5/3/1" },
];

const PARTES = [
  { valor: "superior" as const, label: "Superior", descricao: "Parte superior" },
  { valor: "inferior" as const, label: "Inferior", descricao: "Parte inferior" },
];

/** Números na tela viram string enquanto se digita; vazio vira o padrão, não NaN. */
const num = (s: string, padrao: number) => (s.trim() === "" ? padrao : Number(s));

/**
 * A prescrição de um exercício da rotina.
 *
 * Os campos seguem o tipo escolhido de propósito: pedir Training Max a quem
 * escolheu dupla progressão seria pedir um número que não vai ser usado, e
 * pedir faixa de repetições a quem escolheu 5/3/1 seria pedir um número que o
 * método já define.
 */
export function SheetPrescricao({
  aberto,
  onFechar,
  exercicio,
  onSalvar,
}: {
  aberto: boolean;
  onFechar: () => void;
  exercicio: ExercicioRotina | null;
  onSalvar: (e: ExercicioRotinaInput) => void;
}) {
  const [tipo, setTipo] = useState<TipoPrescricao>("dupla");
  const [series, setSeries] = useState("3");
  const [repsMin, setRepsMin] = useState("8");
  const [repsMax, setRepsMax] = useState("12");
  const [peso, setPeso] = useState("");
  const [incremento, setIncremento] = useState("2.5");
  const [tm, setTm] = useState("");
  const [parte, setParte] = useState<Parte>("superior");
  const [descanso, setDescanso] = useState("90");

  // Abrir o sheet para outro exercício precisa recarregar os campos; sem isso
  // o segundo exercício aberto mostraria os números do primeiro.
  useEffect(() => {
    if (!exercicio) return;
    setTipo(exercicio.prescricao);
    setSeries(String(exercicio.series));
    setRepsMin(exercicio.reps_min == null ? "8" : String(exercicio.reps_min));
    setRepsMax(exercicio.reps_max == null ? "12" : String(exercicio.reps_max));
    setPeso(exercicio.peso_kg == null ? "" : String(exercicio.peso_kg));
    setIncremento(String(exercicio.incremento_kg));
    setTm(exercicio.tm_kg == null ? "" : String(exercicio.tm_kg));
    setParte(exercicio.parte ?? "superior");
    setDescanso(exercicio.descanso_s == null ? "90" : String(exercicio.descanso_s));
  }, [exercicio]);

  if (!exercicio) return null;

  function salvar() {
    onSalvar({
      exercise_id: exercicio!.exercise_id,
      prescricao: tipo,
      series: num(series, 3),
      reps_min: tipo === "dupla" ? num(repsMin, 8) : null,
      reps_max: tipo === "dupla" ? num(repsMax, 12) : tipo === "fixa" ? num(repsMax, 12) : null,
      peso_kg: tipo === "531" ? null : num(peso, 0),
      incremento_kg: num(incremento, 2.5),
      tm_kg: tipo === "531" ? num(tm, 0) : null,
      parte: tipo === "531" ? parte : null,
      descanso_s: num(descanso, 90),
    });
    onFechar();
  }

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{exercicio.nome}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div>
            <Label>Como a carga é decidida</Label>
            <ChipGroup
              opcoes={TIPOS}
              valor={tipo}
              onChange={(v) => v && setTipo(v)}
              rotulo="Tipo de prescrição"
              colunas={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-series">Séries</Label>
              <Input id="p-series" inputMode="numeric" value={series}
                onChange={(e) => setSeries(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-descanso">Descanso (s)</Label>
              <Input id="p-descanso" inputMode="numeric" value={descanso}
                onChange={(e) => setDescanso(e.target.value)} />
            </div>
          </div>

          {tipo === "dupla" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="p-min">Reps mínimas</Label>
                  <Input id="p-min" inputMode="numeric" value={repsMin}
                    onChange={(e) => setRepsMin(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="p-max">Reps máximas</Label>
                  <Input id="p-max" inputMode="numeric" value={repsMax}
                    onChange={(e) => setRepsMax(e.target.value)} />
                </div>
              </div>
              <p className="t-caption">
                Bateu o máximo em todas as séries, a carga sobe sozinha no próximo treino.
              </p>
            </>
          )}

          {tipo === "fixa" && (
            <div>
              <Label htmlFor="p-reps">Repetições</Label>
              <Input id="p-reps" inputMode="numeric" value={repsMax}
                onChange={(e) => setRepsMax(e.target.value)} />
            </div>
          )}

          {tipo !== "531" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-peso">
                  {tipo === "dupla" ? "Peso de partida (kg)" : "Peso (kg)"}
                </Label>
                <Input id="p-peso" inputMode="decimal" value={peso}
                  onChange={(e) => setPeso(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="p-inc">Incremento (kg)</Label>
                <Input id="p-inc" inputMode="decimal" value={incremento}
                  onChange={(e) => setIncremento(e.target.value)} />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="p-tm">Training Max (kg)</Label>
                  <Input id="p-tm" inputMode="decimal" value={tm}
                    onChange={(e) => setTm(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="p-inc">Incremento (kg)</Label>
                  <Input id="p-inc" inputMode="decimal" value={incremento}
                    onChange={(e) => setIncremento(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Parte do corpo</Label>
                <ChipGroup
                  opcoes={PARTES}
                  valor={parte}
                  onChange={(v) => v && setParte(v)}
                  rotulo="Parte do corpo"
                  colunas={2}
                />
                <p className="t-caption mt-1">
                  Define quanto o Training Max sobe por ciclo: 2,5 kg no superior, 5 kg no inferior.
                </p>
              </div>
            </>
          )}
        </div>

        <SheetFooter>
          <Button block onClick={salvar}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Implementar a tela**

Criar `src/pages/treino-rotina.tsx`:

```tsx
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { BackLink, Page, PageHeader } from "@/components/ui/page";
import { SkeletonList } from "@/components/ui/skeleton";
import { ExercicioAutocomplete } from "@/components/treino/exercicio-autocomplete";
import { SheetPrescricao } from "@/components/treino/sheet-prescricao";
import { useExercises } from "@/hooks/use-exercises";
import {
  useAdicionarExercicio,
  useAtualizarExercicio,
  useCriarRotina,
  useDiasDaRotina,
  useExerciciosDaRotina,
  useRemoverExercicio,
  useRotinaAtiva,
  useSalvarDia,
} from "@/hooks/use-rotina";
import type { ExercicioRotina } from "@/repositories/rotina";

export const DIAS_DA_SEMANA = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
] as const;

/** Padrões de quem só quer adicionar um exercício e sair. */
const PADRAO = {
  prescricao: "dupla" as const,
  series: 3,
  reps_min: 8,
  reps_max: 12,
  peso_kg: 0,
  incremento_kg: 2.5,
  tm_kg: null,
  parte: null,
  descanso_s: 90,
};

/** "3 × 8–12" na dupla, "3 × 15" na fixa, "5/3/1 · TM 120 kg" no método. */
function resumoDaPrescricao(e: ExercicioRotina): string {
  if (e.prescricao === "531") return `5/3/1 · TM ${e.tm_kg ?? 0} kg`;
  if (e.prescricao === "fixa") return `${e.series} × ${e.reps_max ?? 0}`;
  return `${e.series} × ${e.reps_min ?? 0}–${e.reps_max ?? 0}`;
}

function Dia({
  diaSemana,
  dayId,
  nome,
  exercicios,
  onRenomear,
  onEditar,
}: {
  diaSemana: number;
  dayId: number | null;
  nome: string | null;
  exercicios: ExercicioRotina[];
  onRenomear: (nome: string) => void;
  onEditar: (e: ExercicioRotina) => void;
}) {
  const [editandoNome, setEditandoNome] = useState(false);
  const [texto, setTexto] = useState(nome ?? "");
  const [adicionando, setAdicionando] = useState(false);
  const { data: catalogo = [] } = useExercises();
  const adicionar = useAdicionarExercicio();
  const remover = useRemoverExercicio();

  const rotulo = DIAS_DA_SEMANA[diaSemana];

  return (
    <Card padded={false}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <span className="t-caption w-16 shrink-0">{rotulo}</span>
        {editandoNome || !nome ? (
          <Input
            aria-label={`Nome do treino de ${rotulo.toLowerCase()}`}
            placeholder="Descanso"
            value={texto}
            autoFocus={editandoNome}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => {
              setEditandoNome(false);
              const novo = texto.trim();
              if (novo && novo !== nome) onRenomear(novo);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => { setTexto(nome); setEditandoNome(true); }}
            className="min-h-11 flex-1 text-left text-[0.9375rem] font-semibold"
          >
            {nome}
          </button>
        )}
      </div>

      {!nome && <p className="t-caption px-4 pb-3">Descanso</p>}

      {nome && dayId !== null && (
        <>
          {exercicios.length > 0 && (
            <ul className="divide-y divide-border border-t border-border">
              {exercicios.map((e) => (
                <li key={e.id} className="flex items-center gap-2 pr-2 pl-4">
                  <button
                    type="button"
                    onClick={() => onEditar(e)}
                    className="min-h-12 min-w-0 flex-1 py-2 text-left"
                  >
                    <span className="block truncate text-sm font-medium">{e.nome}</span>
                    <span className="t-caption block tabular-nums">
                      {resumoDaPrescricao(e)}
                      {e.prescricao !== "531" && e.peso_kg ? ` · ${e.peso_kg} kg` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${e.nome}`}
                    onClick={() => remover.mutate(e.id)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border px-4 py-2">
            {adicionando ? (
              <ExercicioAutocomplete
                id={`add-${dayId}`}
                exercicios={catalogo}
                selecionado={null}
                onSelecionar={(ex) => {
                  if (!ex) return;
                  adicionar.mutate({
                    dayId,
                    entrada: { ...PADRAO, exercise_id: ex.id },
                  });
                  setAdicionando(false);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdicionando(true)}
                aria-label={`Adicionar exercício em ${rotulo.toLowerCase()}`}
                className="flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary"
              >
                <Plus className="size-4" />
                Adicionar exercício
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

export function TreinoRotina() {
  const { data: rotina, isLoading } = useRotinaAtiva();
  const { data: dias = [] } = useDiasDaRotina(rotina);
  const { data: todos = [] } = useExerciciosDaRotina(rotina);
  const criar = useCriarRotina();
  const salvarDia = useSalvarDia();
  const atualizar = useAtualizarExercicio();
  const [emEdicao, setEmEdicao] = useState<ExercicioRotina | null>(null);

  if (isLoading) {
    return (
      <Page>
        <SkeletonList rows={7} />
      </Page>
    );
  }

  if (!rotina) {
    return (
      <Page>
        <PageHeader eyebrow={<BackLink to="/treino">Treino</BackLink>} title="Rotina" />
        <Card>
          <EmptyState
            title="Nenhuma rotina ainda"
            description="Diga ao app o que você treina em cada dia da semana. Depois é só seguir — a carga de cada exercício o app calcula sozinho."
            action={
              <Button onClick={() => criar.mutate("Minha rotina")} disabled={criar.isPending}>
                Criar rotina
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow={<BackLink to="/treino">Treino</BackLink>}
        title="Rotina"
      >
        <p className="t-caption">
          Dia sem nome é descanso. Cada exercício guarda como a carga dele é decidida.
        </p>
      </PageHeader>

      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const dia = dias.find((x) => x.dia_semana === d) ?? null;
          return (
            <Dia
              key={d}
              diaSemana={d}
              dayId={dia?.id ?? null}
              nome={dia?.nome ?? null}
              exercicios={todos.filter((e) => e.dia_semana === d)}
              onRenomear={(nome) =>
                salvarDia.mutate({ routineId: rotina.id, dia_semana: d, nome })
              }
              onEditar={setEmEdicao}
            />
          );
        })}
      </div>

      <SheetPrescricao
        aberto={emEdicao !== null}
        onFechar={() => setEmEdicao(null)}
        exercicio={emEdicao}
        onSalvar={(entrada) => {
          if (emEdicao) atualizar.mutate({ id: emEdicao.id, entrada });
        }}
      />
    </Page>
  );
}
```

- [ ] **Step 5: Ligar a rota e rodar**

Em `src/App.tsx`, trocar o import de `TreinoPrograma` por `import { TreinoRotina } from "./pages/treino-rotina";` e a rota `/treino/programa` por:

```tsx
<Route path="/treino/rotina" element={<TreinoRotina />} />
```

Run: `npm test -- --run src/pages/treino-rotina.test.tsx`
Expected: PASS, os 8 casos. Se o `ExercicioAutocomplete` usar um `aria-label` diferente de `/exercício/i`, ajustar o teste ao que o componente já expõe — não o contrário.

- [ ] **Step 6: Commit**

```bash
git add src/pages/treino-rotina.tsx src/components/treino/sheet-prescricao.tsx src/pages/treino-rotina.test.tsx src/App.tsx
git commit -m "feat(treino): tela de montar a rotina semanal"
```

---

### Task 11: `/treino/sessao` — a tela da academia

**Files:**
- Rewrite: `src/pages/treino-sessao.tsx`
- Create: `src/components/treino/sheet-ajustar-serie.tsx`
- Rewrite: `src/pages/treino-sessao.test.tsx`

**Interfaces:**
- Consumes: `usePlano`, `useRegistrarSerie`, `useDesfazerSerie`, `useAdicionarAoPlano`, `useMarcasAmrap`, `useSessaoEmAndamento` de `src/hooks/use-sessao`; `useHistoricoExercicio` de `src/hooks/use-workouts`; `planejar` de `src/domain/prescricao`; `ehRecorde`, `recordeNoPeso`, `e1RMDaSerie` de `src/domain/531`; `resumirSets` de `src/domain/treino`; `CronometroDescanso`, `ExercicioAutocomplete`.
- Produces:
  - `TreinoSessao` — lê o `session_id` de `useSearchParams()` (`?s=<id>`); sem ele, cai no `sessaoEmAndamento` de hoje.
  - `SheetAjustarSerie({ aberto, onFechar, serie, onRegistrar })` em `src/components/treino/sheet-ajustar-serie.tsx`, onde `serie: PlanoSerie | null` e `onRegistrar: (v: { reps: number; peso_kg: number; tipo: TipoSerie; rir: number | null; nota: string | null }) => void`.

- [ ] **Step 1: Escrever o teste que falha**

Substituir o conteúdo de `src/pages/treino-sessao.test.tsx` por:

```tsx
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
      data: hoje(), nome: "Peito", itens: [item(supino, 40)],
    });
    montar(sid);

    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect((await screen.findAllByText(/12 × 40 kg/)).length).toBe(3);
  });

  it("tocar na série registra exatamente o planejado", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40)],
    });
    montar(sid);

    await userEvent.click((await screen.findAllByRole("button", { name: /registrar série 1/i }))[0]);

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
      data: hoje(), nome: "Peito", itens: [item(supino, 40)],
    });
    montar(sid);

    await userEvent.click((await screen.findAllByRole("button", { name: /registrar série 1/i }))[0]);
    await waitFor(async () => expect(await listSetsBySession(db, 1, sid)).toHaveLength(1));

    await userEvent.click(await screen.findByRole("button", { name: /desfazer série 1/i }));
    await waitFor(async () => expect(await listSetsBySession(db, 1, sid)).toHaveLength(0));
  });

  it("o sheet de ajuste grava reps e peso diferentes do planejado", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40)],
    });
    montar(sid);

    await userEvent.click((await screen.findAllByRole("button", { name: /ajustar série 1/i }))[0]);
    const reps = await screen.findByLabelText(/^reps$/i);
    await userEvent.clear(reps);
    await userEvent.type(reps, "9");
    await userEvent.click(await screen.findByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      const [set] = await listSetsBySession(db, 1, sid);
      expect(set.reps).toBe(9);
    });
  });

  it("navega entre os exercícios da sessão", async () => {
    const supino = await exercicio("Supino reto");
    const crucifixo = await exercicio("Crucifixo");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40), item(crucifixo, 15)],
    });
    montar(sid);

    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /crucifixo/i }));
    expect(await screen.findByText(/12 × 15 kg/)).toBeInTheDocument();
  });

  it("mostra o progresso da sessão no topo", async () => {
    const supino = await exercicio("Supino reto");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40)],
    });
    montar(sid);
    expect(await screen.findByText("0/3")).toBeInTheDocument();

    await userEvent.click((await screen.findAllByRole("button", { name: /registrar série 1/i }))[0]);
    expect(await screen.findByText("1/3")).toBeInTheDocument();
  });

  it("adiciona um exercício fora da rotina no meio da sessão", async () => {
    const supino = await exercicio("Supino reto");
    await exercicio("Rosca direta");
    const sid = await iniciarSessao(db, 1, {
      data: hoje(), nome: "Peito", itens: [item(supino, 40)],
    });
    montar(sid);

    await userEvent.click(await screen.findByRole("button", { name: /adicionar exercício/i }));
    const campo = await screen.findByLabelText(/exercício/i);
    await userEvent.type(campo, "Rosca");
    await userEvent.click(await screen.findByRole("option", { name: /rosca direta/i }));

    await waitFor(async () => {
      const plano = await getPlano(db, 1, sid);
      expect(plano.filter((p) => p.nome === "Rosca direta")).toHaveLength(3);
      expect(plano.at(-1)!.routine_exercise_id).toBeNull();
    });
  });

  it("sem plano nenhum, oferece voltar ao treino", async () => {
    const sid = await iniciarSessao(db, 1, { data: hoje(), nome: null, itens: [] });
    montar(sid);
    expect(await screen.findByRole("button", { name: /adicionar exercício/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/pages/treino-sessao.test.tsx`
Expected: FAIL — a tela atual ainda é a do 5/3/1 e não conhece `?s=`.

- [ ] **Step 3: Implementar o sheet de ajuste**

Criar `src/components/treino/sheet-ajustar-serie.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { rotuloRir } from "@/domain/treino";
import type { TipoSerie } from "@/domain/types";
import type { PlanoSerie } from "@/repositories/sessao";

const TIPOS = [
  { valor: "aquecimento" as const, label: "Aquec.", descricao: "Aquecimento" },
  { valor: "valida" as const, label: "Válida", descricao: "Série válida" },
  { valor: "drop" as const, label: "Drop", descricao: "Drop set" },
  { valor: "falha" as const, label: "Falha", descricao: "Até a falha" },
];

const RIRS = [0, 1, 2, 3, 4].map((r) => ({
  valor: r,
  label: rotuloRir(r),
  descricao: `RIR ${rotuloRir(r)}`,
}));

/**
 * O escape da tela da academia: quando hoje não foi como o plano dizia.
 *
 * Começa preenchido com o prescrito — quem abre para mudar uma coisa só não
 * deve ter que redigitar as outras duas.
 */
export function SheetAjustarSerie({
  aberto,
  onFechar,
  serie,
  onRegistrar,
}: {
  aberto: boolean;
  onFechar: () => void;
  serie: PlanoSerie | null;
  onRegistrar: (v: {
    reps: number; peso_kg: number; tipo: TipoSerie; rir: number | null; nota: string | null;
  }) => void;
}) {
  const [reps, setReps] = useState("");
  const [peso, setPeso] = useState("");
  const [tipo, setTipo] = useState<TipoSerie>("valida");
  const [rir, setRir] = useState<number | null>(null);
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!serie) return;
    setReps(String(serie.reps_feitas ?? serie.reps_alvo));
    setPeso(String(serie.peso_feito_kg ?? serie.peso_kg));
    setTipo(serie.tipo);
    setRir(null);
    setNota("");
  }, [serie]);

  if (!serie) return null;

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{serie.nome} · série {serie.serie_ordem}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-reps">Reps</Label>
              <Input id="a-reps" inputMode="numeric" value={reps}
                onChange={(e) => setReps(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="a-peso">Peso (kg)</Label>
              <Input id="a-peso" inputMode="decimal" value={peso}
                onChange={(e) => setPeso(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Tipo</Label>
            <ChipGroup opcoes={TIPOS} valor={tipo} onChange={(v) => v && setTipo(v)}
              rotulo="Tipo da série" colunas={4} />
          </div>

          <div>
            <Label>RIR (opcional)</Label>
            <ChipGroup opcoes={RIRS} valor={rir} onChange={setRir}
              rotulo="Repetições em reserva" desmarcavel colunas={5} />
          </div>

          <div>
            <Label htmlFor="a-nota">Nota (opcional)</Label>
            <Input id="a-nota" value={nota} placeholder="ombro incomodou"
              onChange={(e) => setNota(e.target.value)} />
          </div>
        </div>

        <SheetFooter>
          <Button
            block
            onClick={() => {
              onRegistrar({
                reps: Number(reps) || serie.reps_alvo,
                peso_kg: Number(peso) || serie.peso_kg,
                tipo,
                rir,
                nota: nota.trim() || null,
              });
              onFechar();
            }}
          >
            Registrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Implementar a tela**

Substituir `src/pages/treino-sessao.tsx` inteiro por:

```tsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Pencil, Plus, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CronometroDescanso } from "@/components/treino/cronometro-descanso";
import { ExercicioAutocomplete } from "@/components/treino/exercicio-autocomplete";
import { SheetAjustarSerie } from "@/components/treino/sheet-ajustar-serie";
import { useExercises } from "@/hooks/use-exercises";
import {
  useAdicionarAoPlano,
  useDesfazerSerie,
  usePlano,
  useRegistrarSerie,
  useSessaoEmAndamento,
} from "@/hooks/use-sessao";
import { useHistoricoExercicio } from "@/hooks/use-workouts";
import { planejar } from "@/domain/prescricao";
import { resumirSets } from "@/domain/treino";
import { hoje } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { PlanoSerie } from "@/repositories/sessao";

/** Padrão de quem adiciona um exercício avulso no meio do treino: o app
 *  planeja por dupla progressão a partir do histórico daquele exercício. */
const AVULSO = { series: 3, reps_min: 8, reps_max: 12, incremento_kg: 2.5 };

function Bolinha({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
        ok ? "border-success bg-success text-white" : "border-input",
      )}
    >
      {ok && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}

/** "Última vez: 3×10 @ 40 kg" — o contexto que justifica a carga de hoje. */
function UltimaVez({ exerciseId }: { exerciseId: number }) {
  const { data: hist = [], isPending } = useHistoricoExercicio(exerciseId, hoje(), 1);
  if (isPending) return null;
  const ultima = hist[0];
  return (
    <p className="t-caption tabular-nums">
      {ultima && ultima.sets.length > 0
        ? `Última vez · ${resumirSets(ultima.sets)}`
        : "Primeira vez neste exercício"}
    </p>
  );
}

function LinhaSerie({
  s,
  onRegistrar,
  onDesfazer,
  onAjustar,
}: {
  s: PlanoSerie;
  onRegistrar: () => void;
  onDesfazer: () => void;
  onAjustar: () => void;
}) {
  const ok = s.set_id !== null;
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={ok ? onDesfazer : onRegistrar}
        aria-label={`${ok ? "Desfazer" : "Registrar"} série ${s.serie_ordem}`}
        className={cn(
          "flex min-h-16 flex-1 items-center gap-3 rounded-xl border px-4 text-left transition-colors",
          ok ? "border-success/40 bg-tint-success" : "border-border bg-card hover:bg-muted",
        )}
      >
        <Bolinha ok={ok} />
        <span className="flex-1 text-[0.9375rem] font-semibold tabular-nums">
          {ok ? s.reps_feitas : s.reps_alvo} × {ok ? s.peso_feito_kg : s.peso_kg} kg
        </span>
        <span className="t-caption shrink-0 tabular-nums">
          {s.pct !== null ? `${s.pct}%` : s.reps_min !== null ? `${s.reps_min}–${s.reps_alvo}` : ""}
          {s.amrap ? " · máx" : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={onAjustar}
        aria-label={`Ajustar série ${s.serie_ordem}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
      >
        <Pencil className="size-4" />
      </button>
    </li>
  );
}

export function TreinoSessao() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const idDaUrl = params.get("s");
  const { data: emAndamento } = useSessaoEmAndamento(hoje());
  const sessionId = idDaUrl ? Number(idDaUrl) : (emAndamento?.session_id ?? undefined);

  const { data: plano = [], isLoading } = usePlano(sessionId);
  const registrar = useRegistrarSerie();
  const desfazer = useDesfazerSerie();
  const adicionar = useAdicionarAoPlano();
  const { data: catalogo = [] } = useExercises();

  const [iExercicio, setIExercicio] = useState(0);
  const [ajustando, setAjustando] = useState<PlanoSerie | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [registros, setRegistros] = useState(0);

  // Blocos de exercício na ordem do plano. `ordem` é contígua por exercício,
  // então basta agrupar preservando a primeira aparição.
  const exercicios = useMemo(() => {
    const blocos: { exercise_id: number; nome: string; series: PlanoSerie[] }[] = [];
    for (const s of plano) {
      const ultimo = blocos.at(-1);
      if (ultimo && ultimo.exercise_id === s.exercise_id) ultimo.series.push(s);
      else blocos.push({ exercise_id: s.exercise_id, nome: s.nome, series: [s] });
    }
    return blocos;
  }, [plano]);

  const feitas = plano.filter((s) => s.set_id !== null).length;
  const atual = exercicios[Math.min(iExercicio, Math.max(exercicios.length - 1, 0))];
  const descanso = atual?.series[0]?.descanso_s ?? null;

  function registrarSerie(s: PlanoSerie, v?: {
    reps: number; peso_kg: number; tipo: typeof s.tipo; rir: number | null; nota: string | null;
  }) {
    registrar.mutate({
      planId: s.id,
      reps: v?.reps ?? s.reps_alvo,
      peso_kg: v?.peso_kg ?? s.peso_kg,
      tipo: v?.tipo ?? s.tipo,
      rir: v?.rir ?? null,
      nota: v?.nota ?? null,
    });
    setRegistros((n) => n + 1);

    // Registrada a última série do exercício, avança sozinho — é o gesto que
    // você faria de qualquer jeito.
    const bloco = exercicios.find((b) => b.exercise_id === s.exercise_id);
    const ultimaDoBloco = bloco?.series.filter((x) => x.set_id === null).length === 1;
    if (ultimaDoBloco && iExercicio < exercicios.length - 1) {
      setIExercicio((i) => i + 1);
    }
  }

  if (isLoading || sessionId === undefined) {
    return (
      <div className="p-4">
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/treino")}
          aria-label="Sair da sessão"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="size-5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {emAndamento?.nome ?? "Treino"}
        </span>
        <span className="t-caption shrink-0 tabular-nums">
          {feitas}/{plano.length}
        </span>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        {atual ? (
          <>
            <div>
              <h1 className="t-title">{atual.nome}</h1>
              <UltimaVez exerciseId={atual.exercise_id} />
            </div>

            <ul className="space-y-2">
              {atual.series.map((s) => (
                <LinhaSerie
                  key={s.id}
                  s={s}
                  onRegistrar={() => registrarSerie(s)}
                  onDesfazer={() => desfazer.mutate(s.id)}
                  onAjustar={() => setAjustando(s)}
                />
              ))}
            </ul>

            {registros > 0 && <CronometroDescanso chave={registros} segundos={descanso ?? undefined} />}
          </>
        ) : (
          <p className="t-caption">
            Esta sessão ainda não tem exercício nenhum. Adicione o primeiro abaixo.
          </p>
        )}

        <div className="rounded-xl border border-dashed border-border p-3">
          {adicionando ? (
            <ExercicioAutocomplete
              id="add-sessao"
              exercicios={catalogo}
              selecionado={null}
              onSelecionar={(ex) => {
                if (!ex || sessionId === undefined) return;
                adicionar.mutate({
                  sessionId,
                  item: {
                    routine_exercise_id: null,
                    exercise_id: ex.id,
                    nome: ex.nome,
                    descanso_s: 90,
                    // Sem histórico em mão aqui, o peso de partida é 0 e o
                    // ajuste da primeira série define a carga real.
                    series: planejar(
                      { tipo: "dupla", ...AVULSO, peso_inicial_kg: 0 },
                      [],
                    ),
                  },
                });
                setAdicionando(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdicionando(true)}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 text-[0.8125rem] font-medium text-primary"
            >
              <Plus className="size-4" />
              Adicionar exercício
            </button>
          )}
        </div>
      </div>

      {exercicios.length > 1 && (
        <nav className="flex gap-1.5 overflow-x-auto border-t border-border px-4 py-2">
          {exercicios.map((b, i) => {
            const completo = b.series.every((s) => s.set_id !== null);
            return (
              <button
                key={b.exercise_id}
                type="button"
                onClick={() => setIExercicio(i)}
                aria-current={i === iExercicio}
                className={cn(
                  "min-h-11 shrink-0 rounded-lg px-3 text-[0.8125rem] font-medium transition-colors",
                  i === iExercicio ? "bg-primary text-primary-foreground"
                    : completo ? "bg-tint-success text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {b.nome}
              </button>
            );
          })}
        </nav>
      )}

      <footer className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-lg">
        <Button block size="lg" onClick={() => navigate("/treino")}>
          {feitas === plano.length && plano.length > 0
            ? "Finalizar treino"
            : `Finalizar (${feitas} de ${plano.length})`}
        </Button>
      </footer>

      <SheetAjustarSerie
        aberto={ajustando !== null}
        onFechar={() => setAjustando(null)}
        serie={ajustando}
        onRegistrar={(v) => {
          if (ajustando) registrarSerie(ajustando, v);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Dar `segundos` ao cronômetro**

`CronometroDescanso` hoje recebe só `chave`. Abrir `src/components/treino/cronometro-descanso.tsx` e acrescentar uma prop opcional `segundos?: number`, usada como duração inicial no lugar do padrão atual. Manter o padrão quando ela vier `undefined` — sessão sem descanso configurado continua se comportando como antes.

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- --run src/pages/treino-sessao.test.tsx`
Expected: PASS, os 8 casos.

- [ ] **Step 7: Commit**

```bash
git add src/pages/treino-sessao.tsx src/components/treino/sheet-ajustar-serie.tsx src/components/treino/cronometro-descanso.tsx src/pages/treino-sessao.test.tsx
git commit -m "feat(treino): tela da academia guiada pelo plano da sessão"
```
