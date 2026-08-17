# Treino por rotina semanal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o 5/3/1 pela rotina semanal como espinha do módulo de treino: a rotina mora no app por dia da semana, a sessão é materializada no banco ao começar, e a carga sobe sozinha por dupla progressão.

**Architecture:** Três camadas novas — `domain/prescricao.ts` (puro: dupla progressão, despacho para o 5/3/1, qual é o treino de hoje), `repositories/rotina.ts` + `repositories/sessao.ts` (todo o SQL), e três telas (`/treino`, `/treino/rotina`, `/treino/sessao`). O plano da sessão vive em `session_plan_sets`, tabela separada de `workout_sets`, para que nenhuma consulta existente confunda série planejada com série feita.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Turso/libSQL, Tailwind 4, Vitest 4 + Testing Library, TypeScript 6.

**Spec:** `docs/superpowers/specs/2026-08-17-treino-rotina-design.md`

## Global Constraints

- Português em nomes de símbolo, comentário e texto de tela. Tabelas e colunas em inglês, como o resto do schema.
- Todo SQL vive em `src/repositories/`. Nenhuma conta na tela; nenhuma query em componente.
- `src/domain/` é puro: sem React, sem banco, sem `Date.now()` implícito em regra de negócio.
- Toda query filtra por `user_id` (direto ou por join até `routines`). Isolamento por usuário é testado.
- Alvo de toque mínimo 44px (WCAG 2.5.8); usar as classes/componentes do design system em `src/components/ui/`.
- Cor nova, só via tokens `oklch` de `src/index.css` — `src/design/palette.test.ts` quebra de propósito se o contraste WCAG AA cair.
- Nenhum `DROP TABLE` em `schema.sql`. Remover uma tabela do arquivo é o suficiente; banco existente mantém os dados inertes.
- Commits frequentes, um por task, mensagem em português no imperativo.
- Rodar a suíte com `npm test -- --run` (o watch mode trava a execução agêntica).

---

### Task 1: `diaSemana` em `lib/date.ts`

**Files:**
- Modify: `src/lib/date.ts`
- Test: `src/lib/date.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `diaSemana(data: string): number` — 0 = domingo.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `src/lib/date.test.ts`:

```ts
describe("diaSemana", () => {
  it("devolve o dia da semana com 0 = domingo", () => {
    expect(diaSemana("2026-08-16")).toBe(0); // domingo
    expect(diaSemana("2026-08-17")).toBe(1); // segunda
    expect(diaSemana("2026-08-22")).toBe(6); // sábado
  });

  // `new Date("2026-08-17").getDay()` interpreta a string como UTC. A oeste de
  // Greenwich isso cai no dia anterior e responde domingo no lugar de segunda.
  it("não escorrega um dia a oeste de Greenwich", () => {
    const tz = process.env.TZ;
    process.env.TZ = "America/Sao_Paulo";
    try {
      expect(diaSemana("2026-08-17")).toBe(1);
    } finally {
      process.env.TZ = tz;
    }
  });
});
```

Incluir `diaSemana` no import de `./date` no topo do arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/lib/date.test.ts`
Expected: FAIL — `diaSemana is not a function` (ou erro de tipo no import).

- [ ] **Step 3: Implementar**

Em `src/lib/date.ts`, logo depois de `dataRelativa`:

```ts
/** Dia da semana de "YYYY-MM-DD": 0 = domingo. Usa `local` de propósito —
 *  `new Date(data).getDay()` leria a string como UTC e, a oeste de Greenwich,
 *  responderia o dia anterior. */
export function diaSemana(data: string): number {
  return local(data).getDay();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- --run src/lib/date.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/date.ts src/lib/date.test.ts
git commit -m "feat(date): diaSemana sem escorregar de fuso"
```

---

### Task 2: `domain/prescricao.ts` — tipos, prescrição fixa e dupla progressão

**Files:**
- Create: `src/domain/prescricao.ts`
- Test: `src/domain/prescricao.test.ts`

**Interfaces:**
- Consumes: `arredondarCarga` e `type Parte` de `src/domain/531.ts`; `type TipoSerie` de `src/domain/types.ts`.
- Produces:
  - `type TipoPrescricao = "dupla" | "fixa" | "531"`
  - `type Prescricao` (união discriminada, ver código abaixo)
  - `interface SessaoAnterior { data: string; sets: { reps: number; peso_kg: number }[] }`
  - `interface SeriePlanejada { ordem: number; peso_kg: number; reps_alvo: number; reps_min: number | null; tipo: TipoSerie; amrap: boolean; pct: number | null }`
  - `planejar(p: Prescricao, anteriores: SessaoAnterior[]): SeriePlanejada[]`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/domain/prescricao.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { planejar, type Prescricao, type SessaoAnterior } from "./prescricao";

const DUPLA: Prescricao = {
  tipo: "dupla",
  series: 3,
  reps_min: 8,
  reps_max: 12,
  peso_inicial_kg: 40,
  incremento_kg: 2.5,
};

/** Uma sessão anterior com `n` séries iguais. */
function sessao(peso: number, reps: number[]): SessaoAnterior {
  return { data: "2026-08-10", sets: reps.map((r) => ({ reps: r, peso_kg: peso })) };
}

describe("planejar — prescrição fixa", () => {
  it("repete a mesma carga e as mesmas reps, ignorando o histórico", () => {
    const p: Prescricao = { tipo: "fixa", series: 4, reps: 15, peso_kg: 20 };
    const s = planejar(p, [sessao(20, [15, 15, 15, 15])]);
    expect(s).toHaveLength(4);
    expect(s.map((x) => x.ordem)).toEqual([1, 2, 3, 4]);
    expect(s.every((x) => x.peso_kg === 20 && x.reps_alvo === 15)).toBe(true);
    expect(s.every((x) => x.tipo === "valida" && !x.amrap)).toBe(true);
  });
});

describe("planejar — dupla progressão", () => {
  it("sem histórico, começa no peso inicial mirando o topo da faixa", () => {
    const s = planejar(DUPLA, []);
    expect(s).toHaveLength(3);
    expect(s[0].peso_kg).toBe(40);
    expect(s[0].reps_alvo).toBe(12);
    expect(s[0].reps_min).toBe(8);
  });

  it("bateu o topo da faixa em TODAS as séries: sobe o incremento", () => {
    const s = planejar(DUPLA, [sessao(40, [12, 12, 12])]);
    expect(s[0].peso_kg).toBe(42.5);
  });

  // A carga sobe pela série mais fraca: 11 numa das três segura o peso.
  it("faltou uma repetição em uma série: mantém a carga", () => {
    const s = planejar(DUPLA, [sessao(40, [12, 12, 11])]);
    expect(s[0].peso_kg).toBe(40);
  });

  it("dentro da faixa mas longe do topo: mantém a carga", () => {
    const s = planejar(DUPLA, [sessao(40, [9, 8, 8])]);
    expect(s[0].peso_kg).toBe(40);
  });

  it("uma falha isolada não derruba a carga", () => {
    const s = planejar(DUPLA, [sessao(40, [8, 8, 6])]);
    expect(s[0].peso_kg).toBe(40);
  });

  it("duas falhas seguidas no mesmo peso derrubam 10%", () => {
    const s = planejar(DUPLA, [sessao(40, [8, 7, 6]), sessao(40, [8, 8, 6])]);
    expect(s[0].peso_kg).toBe(35); // 36 arredondado para baixo no passo de 2,5
  });

  // Falhar em 40 hoje depois de ter falhado em 45 não é reincidência: o peso
  // mudou, e a tentativa em 40 é a primeira nesse peso.
  it("duas falhas em pesos diferentes não derrubam a carga", () => {
    const s = planejar(DUPLA, [sessao(40, [8, 7, 6]), sessao(45, [8, 8, 6])]);
    expect(s[0].peso_kg).toBe(40);
  });

  // Drop set: as séries leves do fim não são a carga de trabalho.
  it("lê a carga de trabalho como o peso mais pesado da sessão", () => {
    const anterior: SessaoAnterior = {
      data: "2026-08-10",
      sets: [
        { reps: 12, peso_kg: 40 },
        { reps: 12, peso_kg: 40 },
        { reps: 12, peso_kg: 40 },
        { reps: 20, peso_kg: 20 },
      ],
    };
    expect(planejar(DUPLA, [anterior])[0].peso_kg).toBe(42.5);
  });
});

describe("planejar — dupla progressão ao longo de seis sessões", () => {
  it("sobe, mantém, mantém, falha, falha, desce", () => {
    const carga = (anteriores: SessaoAnterior[]) => planejar(DUPLA, anteriores)[0].peso_kg;

    const s1: SessaoAnterior[] = [];
    expect(carga(s1)).toBe(40);

    const s2 = [sessao(40, [12, 12, 12]), ...s1];
    expect(carga(s2)).toBe(42.5);

    const s3 = [sessao(42.5, [10, 10, 9]), ...s2];
    expect(carga(s3)).toBe(42.5);

    const s4 = [sessao(42.5, [11, 11, 10]), ...s3];
    expect(carga(s4)).toBe(42.5);

    const s5 = [sessao(42.5, [8, 8, 7]), ...s4];
    expect(carga(s5)).toBe(42.5);

    const s6 = [sessao(42.5, [8, 7, 7]), ...s5];
    expect(carga(s6)).toBe(37.5); // 38,25 arredondado para baixo
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/domain/prescricao.test.ts`
Expected: FAIL — não resolve `./prescricao`.

- [ ] **Step 3: Implementar**

Criar `src/domain/prescricao.ts`:

```ts
import type { TipoSerie } from "./types";
import { arredondarCarga, type Parte } from "./531";

/**
 * Como a carga de hoje é decidida.
 *
 * Puro de propósito: é a conta que manda a pessoa levantar um peso, e conta
 * errada aqui custa uma sessão ou um ombro. Nada aqui conhece React nem banco.
 */

export type TipoPrescricao = "dupla" | "fixa" | "531";

export type Prescricao =
  | {
      tipo: "dupla";
      series: number;
      reps_min: number;
      reps_max: number;
      peso_inicial_kg: number;
      incremento_kg: number;
    }
  | { tipo: "fixa"; series: number; reps: number; peso_kg: number }
  | { tipo: "531"; tm_kg: number; parte: Parte; incremento_kg: number };

/** Uma sessão passada do exercício. Só séries efetivas — aquecimento fora. */
export interface SessaoAnterior {
  data: string;
  sets: { reps: number; peso_kg: number }[];
}

export interface SeriePlanejada {
  /** Posição da série DENTRO do exercício, 1..n. A ordem na sessão inteira é
   *  atribuída por quem materializa — só o repository sabe o que mais tem lá. */
  ordem: number;
  peso_kg: number;
  /** O número a bater. Na dupla progressão é sempre o topo da faixa: é ele
   *  que faz a carga subir, então é ele que aparece na tela. */
  reps_alvo: number;
  /** O piso da faixa, quando há faixa. Terminar dentro dela não é falhar. */
  reps_min: number | null;
  tipo: TipoSerie;
  amrap: boolean;
  /** Percentual do Training Max. Só o 5/3/1 tem. */
  pct: number | null;
}

/** A carga de trabalho de uma sessão passada: o peso mais pesado e as reps
 *  feitas nele. As séries leves do fim (drop set) não são a carga de trabalho. */
function cargaDeTrabalho(s: SessaoAnterior | undefined): { peso: number; reps: number[] } | null {
  if (!s || s.sets.length === 0) return null;
  const peso = Math.max(...s.sets.map((x) => x.peso_kg));
  return { peso, reps: s.sets.filter((x) => x.peso_kg === peso).map((x) => x.reps) };
}

function cargaDupla(
  p: Extract<Prescricao, { tipo: "dupla" }>,
  anteriores: SessaoAnterior[],
): number {
  const ultima = cargaDeTrabalho(anteriores[0]);
  if (!ultima) return p.peso_inicial_kg;

  // Todas as séries no topo da faixa: a carga é sua, sobe.
  if (ultima.reps.every((r) => r >= p.reps_max)) {
    return arredondarCarga(ultima.peso + p.incremento_kg, p.incremento_kg);
  }

  // Dentro da faixa: o trabalho de hoje é ganhar repetição, não peso.
  if (ultima.reps.every((r) => r >= p.reps_min)) return ultima.peso;

  // Falhou. Um dia ruim não derruba a carga; dois no MESMO peso, sim — senão a
  // progressão oscila em torno de um número em vez de subir.
  const anterior = cargaDeTrabalho(anteriores[1]);
  const reincidente =
    anterior !== null &&
    anterior.peso === ultima.peso &&
    anterior.reps.some((r) => r < p.reps_min);

  return reincidente ? arredondarCarga(ultima.peso * 0.9, p.incremento_kg) : ultima.peso;
}

function planejarDupla(
  p: Extract<Prescricao, { tipo: "dupla" }>,
  anteriores: SessaoAnterior[],
): SeriePlanejada[] {
  const peso_kg = cargaDupla(p, anteriores);
  return Array.from({ length: p.series }, (_, i) => ({
    ordem: i + 1,
    peso_kg,
    reps_alvo: p.reps_max,
    reps_min: p.reps_min,
    tipo: "valida" as const,
    amrap: false,
    pct: null,
  }));
}

function planejarFixa(p: Extract<Prescricao, { tipo: "fixa" }>): SeriePlanejada[] {
  return Array.from({ length: p.series }, (_, i) => ({
    ordem: i + 1,
    peso_kg: p.peso_kg,
    reps_alvo: p.reps,
    reps_min: null,
    tipo: "valida" as const,
    amrap: false,
    pct: null,
  }));
}

/** As séries de hoje para UM exercício, dadas as sessões passadas dele —
 *  da mais recente para a mais antiga. */
export function planejar(p: Prescricao, anteriores: SessaoAnterior[]): SeriePlanejada[] {
  switch (p.tipo) {
    case "fixa":
      return planejarFixa(p);
    case "dupla":
      return planejarDupla(p, anteriores);
    case "531":
      throw new Error("prescrição 5/3/1 ainda não implementada");
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- --run src/domain/prescricao.test.ts`
Expected: PASS, todos os casos de fixa e dupla.

- [ ] **Step 5: Commit**

```bash
git add src/domain/prescricao.ts src/domain/prescricao.test.ts
git commit -m "feat(treino): dupla progressão e prescrição fixa"
```

---

### Task 3: `domain/prescricao.ts` — o 5/3/1 como estratégia

**Files:**
- Modify: `src/domain/prescricao.ts`
- Test: `src/domain/prescricao.test.ts`

**Interfaces:**
- Consumes: `sessaoPrescrita`, `tmVigente`, `type Semana` de `src/domain/531.ts`; o `planejar` da Task 2.
- Produces: `posicao531(sessoesFeitas: number): { ciclo: number; semana: Semana }`; `planejar` passa a atender `tipo: "531"`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `src/domain/prescricao.test.ts` (e incluir `posicao531` no import):

```ts
describe("posicao531", () => {
  it("anda uma semana por sessão do exercício e vira o ciclo a cada quatro", () => {
    expect(posicao531(0)).toEqual({ ciclo: 1, semana: 1 });
    expect(posicao531(3)).toEqual({ ciclo: 1, semana: 4 });
    expect(posicao531(4)).toEqual({ ciclo: 2, semana: 1 });
    expect(posicao531(9)).toEqual({ ciclo: 3, semana: 2 });
  });
});

describe("planejar — 5/3/1", () => {
  const P531: Prescricao = { tipo: "531", tm_kg: 100, parte: "inferior", incremento_kg: 2.5 };

  it("primeira sessão: aquecimento 40/50/60 e trabalho 65/75/85 com AMRAP no fim", () => {
    const s = planejar(P531, []);
    expect(s.map((x) => x.pct)).toEqual([40, 50, 60, 65, 75, 85]);
    expect(s.map((x) => x.peso_kg)).toEqual([40, 50, 60, 65, 75, 85]);
    expect(s.slice(0, 3).every((x) => x.tipo === "aquecimento")).toBe(true);
    expect(s.filter((x) => x.amrap)).toHaveLength(1);
    expect(s[5].amrap).toBe(true);
    expect(s[5].reps_alvo).toBe(5);
    expect(s.map((x) => x.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("quarta sessão é deload: sem aquecimento e sem AMRAP", () => {
    const feitas = Array.from({ length: 3 }, () => sessao(85, [5]));
    const s = planejar(P531, feitas);
    expect(s.map((x) => x.pct)).toEqual([40, 50, 60]);
    expect(s.some((x) => x.amrap)).toBe(false);
    expect(s.every((x) => x.tipo === "valida")).toBe(true);
  });

  // Fechado o ciclo, o TM sobe — 5 kg no inferior — e todas as cargas do ciclo
  // seguinte saem do TM novo, não do original.
  it("depois de quatro sessões, o Training Max sobe", () => {
    const feitas = Array.from({ length: 4 }, () => sessao(85, [5]));
    const s = planejar(P531, feitas);
    expect(s.map((x) => x.pct)).toEqual([40, 50, 60, 65, 75, 85]);
    expect(s[3].peso_kg).toBe(67.5); // 65% de 105
  });

  it("no superior o Training Max sobe 2,5 kg por ciclo", () => {
    const p: Prescricao = { tipo: "531", tm_kg: 100, parte: "superior", incremento_kg: 2.5 };
    const feitas = Array.from({ length: 4 }, () => sessao(85, [5]));
    expect(planejar(p, feitas)[3].peso_kg).toBe(65); // 65% de 102,5 = 66,6 → 65
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/domain/prescricao.test.ts`
Expected: FAIL — `posicao531 is not a function` e `prescrição 5/3/1 ainda não implementada`.

- [ ] **Step 3: Implementar**

Em `src/domain/prescricao.ts`, trocar o import do 531 e substituir o `throw`:

```ts
import { arredondarCarga, sessaoPrescrita, tmVigente, type Parte, type Semana } from "./531";
```

```ts
/**
 * Onde o exercício está no 5/3/1, derivado de quantas sessões dele já foram
 * feitas.
 *
 * Numa rotina semanal cada exercício anda no seu próprio passo — não faz
 * sentido segurar a semana do supino esperando o agachamento, como a regra
 * antiga (por programa) fazia.
 */
export function posicao531(sessoesFeitas: number): { ciclo: number; semana: Semana } {
  return {
    ciclo: Math.floor(sessoesFeitas / 4) + 1,
    semana: ((sessoesFeitas % 4) + 1) as Semana,
  };
}

function planejar531(
  p: Extract<Prescricao, { tipo: "531" }>,
  anteriores: SessaoAnterior[],
): SeriePlanejada[] {
  const { ciclo, semana } = posicao531(anteriores.length);
  const tm = tmVigente(p.tm_kg, p.parte, ciclo - 1, p.incremento_kg);
  return sessaoPrescrita(tm, semana, p.incremento_kg).map((s, i) => ({
    ordem: i + 1,
    peso_kg: s.peso_kg,
    reps_alvo: s.reps,
    reps_min: null,
    tipo: s.tipo === "aquecimento" ? ("aquecimento" as const) : ("valida" as const),
    amrap: s.amrap,
    pct: s.pct,
  }));
}
```

E no `switch`, trocar o `throw` por `return planejar531(p, anteriores);`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- --run src/domain/prescricao.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/prescricao.ts src/domain/prescricao.test.ts
git commit -m "feat(treino): 5/3/1 vira uma estratégia de prescrição"
```

---

### Task 4: `domain/prescricao.ts` — qual é o treino de hoje

**Files:**
- Modify: `src/domain/prescricao.ts`
- Test: `src/domain/prescricao.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces:
  - `treinoDoDia<T extends { dia_semana: number }>(dias: T[], diaSemana: number): T | null`
  - `proximoTreino<T extends { dia_semana: number }>(dias: T[], diaSemana: number): T | null`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `src/domain/prescricao.test.ts` (incluir os dois no import):

```ts
describe("treinoDoDia e proximoTreino", () => {
  // 1 = segunda, 3 = quarta, 5 = sexta
  const DIAS = [
    { dia_semana: 1, nome: "Peito e tríceps" },
    { dia_semana: 3, nome: "Costas e bíceps" },
    { dia_semana: 5, nome: "Perna" },
  ];

  it("acha o treino do dia", () => {
    expect(treinoDoDia(DIAS, 3)?.nome).toBe("Costas e bíceps");
  });

  it("devolve null num dia de descanso", () => {
    expect(treinoDoDia(DIAS, 2)).toBeNull();
  });

  it("o próximo treino é o dia de treino seguinte", () => {
    expect(proximoTreino(DIAS, 2)?.nome).toBe("Costas e bíceps");
  });

  it("dá a volta na semana", () => {
    expect(proximoTreino(DIAS, 6)?.nome).toBe("Peito e tríceps");
  });

  it("rotina sem dia nenhum não tem próximo", () => {
    expect(proximoTreino([], 2)).toBeNull();
    expect(treinoDoDia([], 2)).toBeNull();
  });

  it("com um único dia de treino, o próximo é ele mesmo na semana que vem", () => {
    const um = [{ dia_semana: 1, nome: "Full body" }];
    expect(proximoTreino(um, 1)?.nome).toBe("Full body");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/domain/prescricao.test.ts`
Expected: FAIL — `treinoDoDia is not a function`.

- [ ] **Step 3: Implementar**

No fim de `src/domain/prescricao.ts`:

```ts
/* ══════════════════════════════════════════════════════════════════
   QUAL É O TREINO DE HOJE

   A rotina é semanal e indexada pelo dia (0 = domingo). Dia sem
   entrada é descanso — a ausência é o dado, não um registro de
   "descanso" que precisaria ser criado e mantido.
   ══════════════════════════════════════════════════════════════════ */

export function treinoDoDia<T extends { dia_semana: number }>(
  dias: T[],
  diaSemana: number,
): T | null {
  return dias.find((d) => d.dia_semana === diaSemana) ?? null;
}

/**
 * O próximo dia de treino a partir de `diaSemana`, exclusive.
 *
 * Anda até sete casas: na sétima o alvo é o próprio `diaSemana`, o que dá a
 * resposta certa para quem treina uma vez por semana — o próximo é ele mesmo,
 * daqui a sete dias.
 */
export function proximoTreino<T extends { dia_semana: number }>(
  dias: T[],
  diaSemana: number,
): T | null {
  for (let i = 1; i <= 7; i++) {
    const alvo = (diaSemana + i) % 7;
    const d = dias.find((x) => x.dia_semana === alvo);
    if (d) return d;
  }
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- --run src/domain/prescricao.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/prescricao.ts src/domain/prescricao.test.ts
git commit -m "feat(treino): qual é o treino de hoje e qual é o próximo"
```

---

### Task 5: Schema — tabelas da rotina e do plano da sessão

**Files:**
- Modify: `src/db/schema.sql`
- Test: `test/helpers/test-db.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: tabelas `routines`, `routine_days`, `routine_exercises`, `session_plan_sets`. Some as tabelas `strength_programs`, `program_lifts`, `program_sessions`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `test/helpers/test-db.test.ts`, dentro do `describe("createTestDb")`:

```ts
it("cria as tabelas da rotina e do plano da sessão", async () => {
  const db = await createTestDb();
  const cols = async (t: string) =>
    (await db.execute(`PRAGMA table_info(${t})`)).rows.map((r) => r.name as string);

  expect(await cols("routines")).toEqual(
    expect.arrayContaining(["id", "user_id", "nome", "ativa", "created_at"]),
  );
  expect(await cols("routine_days")).toEqual(
    expect.arrayContaining(["id", "routine_id", "dia_semana", "nome"]),
  );
  expect(await cols("routine_exercises")).toEqual(
    expect.arrayContaining([
      "id", "day_id", "exercise_id", "ordem", "prescricao", "series",
      "reps_min", "reps_max", "peso_kg", "incremento_kg", "tm_kg", "parte", "descanso_s",
    ]),
  );
  expect(await cols("session_plan_sets")).toEqual(
    expect.arrayContaining([
      "id", "user_id", "session_id", "routine_exercise_id", "exercise_id",
      "ordem", "serie_ordem", "peso_kg", "reps_alvo", "reps_min",
      "tipo", "amrap", "pct", "descanso_s", "set_id",
    ]),
  );
  db.close();
});

it("um dia da semana só pode ter um treino na mesma rotina", async () => {
  const db = await createTestDb();
  const now = new Date().toISOString();
  const r = await db.execute({
    sql: "INSERT INTO routines (user_id, nome, ativa, created_at) VALUES (1, 'Minha rotina', 1, ?)",
    args: [now],
  });
  const routineId = Number(r.lastInsertRowid);
  await db.execute({
    sql: "INSERT INTO routine_days (routine_id, dia_semana, nome) VALUES (?, 1, 'Peito')",
    args: [routineId],
  });
  await expect(
    db.execute({
      sql: "INSERT INTO routine_days (routine_id, dia_semana, nome) VALUES (?, 1, 'Costas')",
      args: [routineId],
    }),
  ).rejects.toThrow();
  db.close();
});

it("não cria mais as tabelas do programa 5/3/1", async () => {
  const db = await createTestDb();
  const rs = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('strength_programs','program_lifts','program_sessions')",
  );
  expect(rs.rows).toHaveLength(0);
  db.close();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run test/helpers/test-db.test.ts`
Expected: FAIL — `no such table: routines`.

- [ ] **Step 3: Implementar**

Em `src/db/schema.sql`, **apagar** o bloco inteiro que cria `strength_programs`, `program_lifts` e `program_sessions` (a partir do comentário da linha ~321 até o fim desse bloco), e pôr no lugar:

```sql
/* ══════════════════════════════════════════════════════════════════
   ROTINA DE TREINO

   A espinha do módulo. Sete dias da semana; dia sem entrada é
   descanso — a ausência é o dado, e não um registro de "descanso"
   que precisaria ser criado e mantido em sincronia.

   As tabelas do programa 5/3/1 (strength_programs, program_lifts,
   program_sessions) saíram daqui: o Training Max virou coluna de
   routine_exercises. Num banco que já existe elas continuam lá com
   os dados — remover do schema não emite DROP, de propósito.
   ══════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS routines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  nome       TEXT NOT NULL,
  ativa      INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_routines_user ON routines (user_id, ativa);

CREATE TABLE IF NOT EXISTS routine_days (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),  -- 0 = domingo
  nome       TEXT NOT NULL,
  UNIQUE (routine_id, dia_semana),
  FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id        INTEGER NOT NULL,
  exercise_id   INTEGER NOT NULL,
  ordem         INTEGER NOT NULL,
  prescricao    TEXT NOT NULL DEFAULT 'dupla',  -- 'dupla' | 'fixa' | '531'
  series        INTEGER NOT NULL DEFAULT 3,
  reps_min      INTEGER,
  reps_max      INTEGER,
  peso_kg       REAL,       -- 'fixa': a carga. 'dupla': o ponto de partida
  incremento_kg REAL NOT NULL DEFAULT 2.5,
  tm_kg         REAL,       -- só '531'
  parte         TEXT,       -- só '531': 'superior' | 'inferior'
  descanso_s    INTEGER,
  FOREIGN KEY (day_id)      REFERENCES routine_days (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
CREATE INDEX IF NOT EXISTS idx_routine_ex_day ON routine_exercises (day_id, ordem);

/* O plano congelado de uma sessão.

   Tabela separada de workout_sets de propósito: seis consultas já leem
   workout_sets como "o que foi feito" (setsForAnalise, setsForExercise,
   ultimaVezExercicio, o histórico, a progressão, o balanço energético).
   Uma coluna `feito` ali obrigaria todas a filtrar, e a que ficasse de
   fora contaria série planejada como treino realizado — num número que
   ninguém confere.

   `ordem` é a posição na sessão inteira (desenha a tela); `serie_ordem` é
   a posição dentro do exercício e é o que vai para workout_sets.ordem,
   que `ultimaVezExercicio` já assume no seu ORDER BY. */
CREATE TABLE IF NOT EXISTS session_plan_sets (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL,
  session_id          INTEGER NOT NULL,
  routine_exercise_id INTEGER,          -- NULL quando o exercício foi avulso
  exercise_id         INTEGER NOT NULL,
  ordem               INTEGER NOT NULL,
  serie_ordem         INTEGER NOT NULL,
  peso_kg             REAL NOT NULL,
  reps_alvo           INTEGER NOT NULL,
  reps_min            INTEGER,
  tipo                TEXT NOT NULL DEFAULT 'valida',
  amrap               INTEGER NOT NULL DEFAULT 0,
  pct                 REAL,
  descanso_s          INTEGER,
  set_id              INTEGER,          -- workout_sets; NULL = ainda não feita
  FOREIGN KEY (session_id)  REFERENCES workout_sessions (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
CREATE INDEX IF NOT EXISTS idx_plan_sets_session ON session_plan_sets (user_id, session_id, ordem);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- --run test/helpers/test-db.test.ts`
Expected: PASS. Os testes de `src/repositories/programa.test.ts` passam a falhar — é esperado; a Task 13 apaga o arquivo.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.sql test/helpers/test-db.test.ts
git commit -m "feat(db): tabelas da rotina e do plano da sessão"
```

---

### Task 6: `repositories/rotina.ts`

**Files:**
- Create: `src/repositories/rotina.ts`
- Test: `src/repositories/rotina.test.ts`

**Interfaces:**
- Consumes: `type TipoPrescricao` de `src/domain/prescricao.ts`; `type Parte` de `src/domain/531.ts`; `createTestDb` de `test/helpers/test-db`.
- Produces:
  - `interface Rotina { id: number; nome: string; ativa: boolean; created_at: string }`
  - `interface DiaRotina { id: number; routine_id: number; dia_semana: number; nome: string }`
  - `interface ExercicioRotina { id: number; day_id: number; exercise_id: number; nome: string; ordem: number; prescricao: TipoPrescricao; series: number; reps_min: number | null; reps_max: number | null; peso_kg: number | null; incremento_kg: number; tm_kg: number | null; parte: Parte | null; descanso_s: number | null }`
  - `type ExercicioRotinaInput = Omit<ExercicioRotina, "id" | "day_id" | "nome" | "ordem">`
  - `getRotinaAtiva(db, userId): Promise<Rotina | null>`
  - `criarRotina(db, userId, nome: string): Promise<Rotina>`
  - `listDias(db, userId, routineId): Promise<DiaRotina[]>`
  - `salvarDia(db, userId, routineId, dia_semana: number, nome: string): Promise<DiaRotina>`
  - `removerDia(db, userId, dayId): Promise<void>`
  - `listExercicios(db, userId, dayId): Promise<ExercicioRotina[]>`
  - `listExerciciosDaRotina(db, userId, routineId): Promise<(ExercicioRotina & { dia_semana: number })[]>`
  - `adicionarExercicio(db, userId, dayId, entrada: ExercicioRotinaInput): Promise<number>`
  - `atualizarExercicio(db, userId, id, entrada: ExercicioRotinaInput): Promise<void>`
  - `removerExercicio(db, userId, id): Promise<void>`
  - `reordenarExercicios(db, userId, dayId, ids: number[]): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/repositories/rotina.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
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
} from "./rotina";

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

const DUPLA: ExercicioRotinaInput = {
  exercise_id: 0,
  prescricao: "dupla",
  series: 3,
  reps_min: 8,
  reps_max: 12,
  peso_kg: 40,
  incremento_kg: 2.5,
  tm_kg: null,
  parte: null,
  descanso_s: 90,
};

beforeEach(async () => {
  db = await createTestDb();
});

describe("rotina", () => {
  it("não há rotina ativa antes de criar uma", async () => {
    expect(await getRotinaAtiva(db, USER)).toBeNull();
  });

  it("cria e devolve a rotina ativa", async () => {
    const r = await criarRotina(db, USER, "Minha rotina");
    const ativa = await getRotinaAtiva(db, USER);
    expect(ativa?.id).toBe(r.id);
    expect(ativa?.nome).toBe("Minha rotina");
    expect(ativa?.ativa).toBe(true);
  });

  it("a rotina de um usuário não aparece para outro", async () => {
    await criarRotina(db, USER, "Minha rotina");
    expect(await getRotinaAtiva(db, OUTRO)).toBeNull();
  });

  it("salvarDia cria e depois renomeia o mesmo dia", async () => {
    const r = await criarRotina(db, USER, "R");
    const d1 = await salvarDia(db, USER, r.id, 1, "Peito");
    const d2 = await salvarDia(db, USER, r.id, 1, "Peito e tríceps");
    expect(d2.id).toBe(d1.id);
    const dias = await listDias(db, USER, r.id);
    expect(dias).toHaveLength(1);
    expect(dias[0].nome).toBe("Peito e tríceps");
  });

  it("lista os dias em ordem de dia da semana", async () => {
    const r = await criarRotina(db, USER, "R");
    await salvarDia(db, USER, r.id, 5, "Perna");
    await salvarDia(db, USER, r.id, 1, "Peito");
    await salvarDia(db, USER, r.id, 3, "Costas");
    expect((await listDias(db, USER, r.id)).map((d) => d.dia_semana)).toEqual([1, 3, 5]);
  });

  it("adiciona exercícios ao dia, numerando a ordem sozinho", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const supino = await exercicio("Supino reto");
    const crucifixo = await exercicio("Crucifixo");
    await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: supino });
    await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: crucifixo });

    const lista = await listExercicios(db, USER, d.id);
    expect(lista.map((e) => e.nome)).toEqual(["Supino reto", "Crucifixo"]);
    expect(lista.map((e) => e.ordem)).toEqual([1, 2]);
    expect(lista[0].series).toBe(3);
    expect(lista[0].reps_min).toBe(8);
    expect(lista[0].descanso_s).toBe(90);
  });

  it("atualiza a prescrição de um exercício", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Perna");
    const agacho = await exercicio("Agachamento");
    const id = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: agacho });

    await atualizarExercicio(db, USER, id, {
      exercise_id: agacho,
      prescricao: "531",
      series: 3,
      reps_min: null,
      reps_max: null,
      peso_kg: null,
      incremento_kg: 2.5,
      tm_kg: 120,
      parte: "inferior",
      descanso_s: 180,
    });

    const [e] = await listExercicios(db, USER, d.id);
    expect(e.prescricao).toBe("531");
    expect(e.tm_kg).toBe(120);
    expect(e.parte).toBe("inferior");
    expect(e.reps_min).toBeNull();
  });

  it("reordena os exercícios do dia", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const a = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("A") });
    const b = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("B") });
    const c = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("C") });

    await reordenarExercicios(db, USER, d.id, [c, a, b]);
    expect((await listExercicios(db, USER, d.id)).map((e) => e.nome)).toEqual(["C", "A", "B"]);
  });

  it("remover o dia leva os exercícios dele junto", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("Supino") });

    await removerDia(db, USER, d.id);
    expect(await listDias(db, USER, r.id)).toHaveLength(0);
    expect(await listExercicios(db, USER, d.id)).toHaveLength(0);
  });

  it("remove um exercício isolado", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const id = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("Supino") });
    await removerExercicio(db, USER, id);
    expect(await listExercicios(db, USER, d.id)).toHaveLength(0);
  });

  it("um usuário não apaga exercício da rotina do outro", async () => {
    const r = await criarRotina(db, USER, "R");
    const d = await salvarDia(db, USER, r.id, 1, "Peito");
    const id = await adicionarExercicio(db, USER, d.id, { ...DUPLA, exercise_id: await exercicio("Supino") });

    await removerExercicio(db, OUTRO, id);
    expect(await listExercicios(db, USER, d.id)).toHaveLength(1);
  });

  it("lista a rotina inteira com o dia da semana de cada exercício", async () => {
    const r = await criarRotina(db, USER, "R");
    const seg = await salvarDia(db, USER, r.id, 1, "Peito");
    const qua = await salvarDia(db, USER, r.id, 3, "Costas");
    await adicionarExercicio(db, USER, seg.id, { ...DUPLA, exercise_id: await exercicio("Supino") });
    await adicionarExercicio(db, USER, qua.id, { ...DUPLA, exercise_id: await exercicio("Remada") });

    const todos = await listExerciciosDaRotina(db, USER, r.id);
    expect(todos.map((e) => [e.dia_semana, e.nome])).toEqual([
      [1, "Supino"],
      [3, "Remada"],
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/repositories/rotina.test.ts`
Expected: FAIL — não resolve `./rotina`.

- [ ] **Step 3: Implementar**

Criar `src/repositories/rotina.ts`:

```ts
import type { Client, Row } from "@libsql/client";
import type { Parte } from "../domain/531";
import type { TipoPrescricao } from "../domain/prescricao";

export interface Rotina {
  id: number;
  nome: string;
  ativa: boolean;
  created_at: string;
}

export interface DiaRotina {
  id: number;
  routine_id: number;
  dia_semana: number;
  nome: string;
}

export interface ExercicioRotina {
  id: number;
  day_id: number;
  exercise_id: number;
  /** Vem de `exercises.nome` — a tela nunca precisa de um segundo join. */
  nome: string;
  ordem: number;
  prescricao: TipoPrescricao;
  series: number;
  reps_min: number | null;
  reps_max: number | null;
  peso_kg: number | null;
  incremento_kg: number;
  tm_kg: number | null;
  parte: Parte | null;
  descanso_s: number | null;
}

export type ExercicioRotinaInput = Omit<ExercicioRotina, "id" | "day_id" | "nome" | "ordem">;

/**
 * Dono do dia, para o WHERE das escritas.
 *
 * `routine_days` e `routine_exercises` não guardam `user_id`: a posse sobe por
 * `routines`. Denormalizar o dono em três tabelas criaria três lugares para
 * ele divergir.
 */
const DIAS_DO_USUARIO = `
  SELECT d.id FROM routine_days d
  JOIN routines r ON r.id = d.routine_id
  WHERE r.user_id = ?`;

function mapRotina(r: Row): Rotina {
  return {
    id: r.id as number,
    nome: r.nome as string,
    ativa: Number(r.ativa) === 1,
    created_at: r.created_at as string,
  };
}

function mapDia(r: Row): DiaRotina {
  return {
    id: r.id as number,
    routine_id: r.routine_id as number,
    dia_semana: r.dia_semana as number,
    nome: r.nome as string,
  };
}

function mapExercicio(r: Row): ExercicioRotina {
  return {
    id: r.id as number,
    day_id: r.day_id as number,
    exercise_id: r.exercise_id as number,
    nome: (r.exercicio_nome as string | null) ?? "?",
    ordem: r.ordem as number,
    prescricao: r.prescricao as TipoPrescricao,
    series: r.series as number,
    reps_min: (r.reps_min as number | null) ?? null,
    reps_max: (r.reps_max as number | null) ?? null,
    peso_kg: (r.peso_kg as number | null) ?? null,
    incremento_kg: r.incremento_kg as number,
    tm_kg: (r.tm_kg as number | null) ?? null,
    parte: (r.parte as Parte | null) ?? null,
    descanso_s: (r.descanso_s as number | null) ?? null,
  };
}

export async function getRotinaAtiva(db: Client, userId: number): Promise<Rotina | null> {
  const rs = await db.execute({
    sql: "SELECT * FROM routines WHERE user_id=? AND ativa=1 ORDER BY id DESC LIMIT 1",
    args: [userId],
  });
  return rs.rows.length ? mapRotina(rs.rows[0]) : null;
}

export async function criarRotina(db: Client, userId: number, nome: string): Promise<Rotina> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: "INSERT INTO routines (user_id, nome, ativa, created_at) VALUES (?, ?, 1, ?)",
    args: [userId, nome, created_at],
  });
  return { id: Number(rs.lastInsertRowid), nome, ativa: true, created_at };
}

export async function listDias(
  db: Client,
  userId: number,
  routineId: number,
): Promise<DiaRotina[]> {
  const rs = await db.execute({
    sql: `SELECT d.* FROM routine_days d
          JOIN routines r ON r.id = d.routine_id
          WHERE r.user_id = ? AND d.routine_id = ?
          ORDER BY d.dia_semana`,
    args: [userId, routineId],
  });
  return rs.rows.map(mapDia);
}

/** Cria o dia ou renomeia o que já existe naquele dia da semana. */
export async function salvarDia(
  db: Client,
  userId: number,
  routineId: number,
  dia_semana: number,
  nome: string,
): Promise<DiaRotina> {
  const dono = await db.execute({
    sql: "SELECT id FROM routines WHERE id=? AND user_id=?",
    args: [routineId, userId],
  });
  if (!dono.rows.length) throw new Error("rotina não encontrada");

  await db.execute({
    sql: `INSERT INTO routine_days (routine_id, dia_semana, nome) VALUES (?, ?, ?)
          ON CONFLICT (routine_id, dia_semana) DO UPDATE SET nome = excluded.nome`,
    args: [routineId, dia_semana, nome],
  });

  const rs = await db.execute({
    sql: "SELECT * FROM routine_days WHERE routine_id=? AND dia_semana=?",
    args: [routineId, dia_semana],
  });
  return mapDia(rs.rows[0]);
}

export async function removerDia(db: Client, userId: number, dayId: number): Promise<void> {
  // Apaga o filho antes do pai em vez de contar com ON DELETE CASCADE: a
  // pragma de chave estrangeira não é garantida ligada, e `deleteSession` já
  // resolve assim neste repositório.
  await db.batch(
    [
      {
        sql: `DELETE FROM routine_exercises WHERE day_id = ? AND day_id IN (${DIAS_DO_USUARIO})`,
        args: [dayId, userId],
      },
      {
        sql: `DELETE FROM routine_days WHERE id = ? AND id IN (${DIAS_DO_USUARIO})`,
        args: [dayId, userId],
      },
    ],
    "write",
  );
}

const SELECT_EXERCICIOS = `
  SELECT re.*, e.nome AS exercicio_nome, d.dia_semana AS dia_semana
  FROM routine_exercises re
  JOIN routine_days d ON d.id = re.day_id
  JOIN routines r     ON r.id = d.routine_id
  LEFT JOIN exercises e ON e.id = re.exercise_id
  WHERE r.user_id = ?`;

export async function listExercicios(
  db: Client,
  userId: number,
  dayId: number,
): Promise<ExercicioRotina[]> {
  const rs = await db.execute({
    sql: `${SELECT_EXERCICIOS} AND re.day_id = ? ORDER BY re.ordem`,
    args: [userId, dayId],
  });
  return rs.rows.map(mapExercicio);
}

export async function listExerciciosDaRotina(
  db: Client,
  userId: number,
  routineId: number,
): Promise<(ExercicioRotina & { dia_semana: number })[]> {
  const rs = await db.execute({
    sql: `${SELECT_EXERCICIOS} AND d.routine_id = ? ORDER BY d.dia_semana, re.ordem`,
    args: [userId, routineId],
  });
  return rs.rows.map((r) => ({ ...mapExercicio(r), dia_semana: r.dia_semana as number }));
}

export async function adicionarExercicio(
  db: Client,
  userId: number,
  dayId: number,
  e: ExercicioRotinaInput,
): Promise<number> {
  // MAX(ordem)+1, não COUNT+1: apagar um exercício do meio deixa buraco na
  // sequência, e COUNT+1 repetiria uma ordem já usada.
  const rs0 = await db.execute({
    sql: `SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima
          FROM routine_exercises WHERE day_id = ? AND day_id IN (${DIAS_DO_USUARIO})`,
    args: [dayId, userId],
  });
  const ordem = rs0.rows[0].proxima as number;

  const rs = await db.execute({
    sql: `INSERT INTO routine_exercises
            (day_id, exercise_id, ordem, prescricao, series, reps_min, reps_max,
             peso_kg, incremento_kg, tm_kg, parte, descanso_s)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE ? IN (${DIAS_DO_USUARIO})`,
    args: [
      dayId, e.exercise_id, ordem, e.prescricao, e.series, e.reps_min, e.reps_max,
      e.peso_kg, e.incremento_kg, e.tm_kg, e.parte, e.descanso_s,
      dayId, userId,
    ],
  });
  return Number(rs.lastInsertRowid);
}

export async function atualizarExercicio(
  db: Client,
  userId: number,
  id: number,
  e: ExercicioRotinaInput,
): Promise<void> {
  await db.execute({
    sql: `UPDATE routine_exercises
          SET exercise_id=?, prescricao=?, series=?, reps_min=?, reps_max=?,
              peso_kg=?, incremento_kg=?, tm_kg=?, parte=?, descanso_s=?
          WHERE id = ? AND day_id IN (${DIAS_DO_USUARIO})`,
    args: [
      e.exercise_id, e.prescricao, e.series, e.reps_min, e.reps_max,
      e.peso_kg, e.incremento_kg, e.tm_kg, e.parte, e.descanso_s,
      id, userId,
    ],
  });
}

export async function removerExercicio(db: Client, userId: number, id: number): Promise<void> {
  await db.execute({
    sql: `DELETE FROM routine_exercises WHERE id = ? AND day_id IN (${DIAS_DO_USUARIO})`,
    args: [id, userId],
  });
}

/** Grava a ordem dos exercícios do dia como a sequência de ids recebida. */
export async function reordenarExercicios(
  db: Client,
  userId: number,
  dayId: number,
  ids: number[],
): Promise<void> {
  if (ids.length === 0) return;
  await db.batch(
    ids.map((id, i) => ({
      sql: `UPDATE routine_exercises SET ordem = ?
            WHERE id = ? AND day_id = ? AND day_id IN (${DIAS_DO_USUARIO})`,
      args: [i + 1, id, dayId, userId],
    })),
    "write",
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- --run src/repositories/rotina.test.ts`
Expected: PASS, os 12 casos.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/rotina.ts src/repositories/rotina.test.ts
git commit -m "feat(treino): repositório da rotina semanal"
```

---

### Task 7: `historicoExercicio` em `repositories/workouts.ts`

**Files:**
- Modify: `src/repositories/workouts.ts`
- Test: `src/repositories/workouts.test.ts`

**Interfaces:**
- Consumes: `type SessaoAnterior` de `src/domain/prescricao.ts`.
- Produces: `historicoExercicio(db, userId, exercise_id: number, antesDe: string, limite?: number): Promise<SessaoAnterior[]>` — sessões da mais recente para a mais antiga, só séries efetivas.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `src/repositories/workouts.test.ts` (incluir `historicoExercicio` no import):

```ts
describe("historicoExercicio", () => {
  it("devolve as sessões da mais recente para a mais antiga, sem aquecimento", async () => {
    const ex = await exercicio("Supino");
    const s1 = await createSession(db, USER, { data: "2026-08-01", nome: null });
    await addSet(db, USER, { session_id: s1.id, exercise_id: ex, ordem: 1, reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null });
    await addSet(db, USER, { session_id: s1.id, exercise_id: ex, ordem: 2, reps: 9, peso_kg: 40, tipo: "valida", rir: null, nota: null });

    const s2 = await createSession(db, USER, { data: "2026-08-08", nome: null });
    await addSet(db, USER, { session_id: s2.id, exercise_id: ex, ordem: 1, reps: 5, peso_kg: 20, tipo: "aquecimento", rir: null, nota: null });
    await addSet(db, USER, { session_id: s2.id, exercise_id: ex, ordem: 2, reps: 12, peso_kg: 40, tipo: "valida", rir: null, nota: null });

    const hist = await historicoExercicio(db, USER, ex, "2026-08-15");
    expect(hist.map((h) => h.data)).toEqual(["2026-08-08", "2026-08-01"]);
    expect(hist[0].sets).toEqual([{ reps: 12, peso_kg: 40 }]);
    expect(hist[1].sets).toEqual([
      { reps: 10, peso_kg: 40 },
      { reps: 9, peso_kg: 40 },
    ]);
  });

  it("respeita o limite e ignora sessões a partir de `antesDe`", async () => {
    const ex = await exercicio("Agachamento");
    for (const data of ["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-22"]) {
      const s = await createSession(db, USER, { data, nome: null });
      await addSet(db, USER, { session_id: s.id, exercise_id: ex, ordem: 1, reps: 5, peso_kg: 60, tipo: "valida", rir: null, nota: null });
    }
    const hist = await historicoExercicio(db, USER, ex, "2026-08-22", 2);
    expect(hist.map((h) => h.data)).toEqual(["2026-08-15", "2026-08-08"]);
  });

  it("não enxerga o histórico de outro usuário", async () => {
    const ex = await exercicio("Remada");
    const s = await createSession(db, OUTRO, { data: "2026-08-01", nome: null });
    await addSet(db, OUTRO, { session_id: s.id, exercise_id: ex, ordem: 1, reps: 10, peso_kg: 30, tipo: "valida", rir: null, nota: null });
    expect(await historicoExercicio(db, USER, ex, "2026-08-15")).toEqual([]);
  });
});
```

Se `exercicio()`, `USER` ou `OUTRO` não existirem no arquivo, criar no topo do `describe` seguindo o que já houver lá — o padrão é o mesmo de `rotina.test.ts` na Task 6.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- --run src/repositories/workouts.test.ts`
Expected: FAIL — `historicoExercicio is not a function`.

- [ ] **Step 3: Implementar**

No fim de `src/repositories/workouts.ts`:

```ts
/**
 * As últimas `limite` sessões do exercício antes de `antesDe`, da mais recente
 * para a mais antiga — o insumo de `planejar`.
 *
 * `ultimaVezExercicio` responde a mesma pergunta para uma sessão só e continua
 * servindo o painel "última vez". A dupla progressão precisa de duas para
 * saber se uma falha é reincidência.
 */
export async function historicoExercicio(
  db: Client,
  userId: number,
  exercise_id: number,
  antesDe: string,
  limite = 3,
): Promise<SessaoAnterior[]> {
  const rs = await db.execute({
    sql: `SELECT s.id AS session_id, s.data AS data
          FROM workout_sets ws
          JOIN workout_sessions s ON s.id = ws.session_id
          WHERE ws.user_id = ? AND ws.exercise_id = ? AND s.data < ? AND ws.tipo <> 'aquecimento'
          GROUP BY s.id
          ORDER BY s.data DESC, s.id DESC
          LIMIT ?`,
    args: [userId, exercise_id, antesDe, limite],
  });
  if (!rs.rows.length) return [];

  const sessoes = rs.rows.map((r) => ({
    id: r.session_id as number,
    data: r.data as string,
  }));

  const marcadores = sessoes.map(() => "?").join(", ");
  const rs2 = await db.execute({
    sql: `SELECT session_id, reps, peso_kg
          FROM workout_sets
          WHERE user_id = ? AND exercise_id = ? AND tipo <> 'aquecimento'
            AND session_id IN (${marcadores})
          ORDER BY ordem`,
    args: [userId, exercise_id, ...sessoes.map((s) => s.id)],
  });

  const porSessao = new Map<number, { reps: number; peso_kg: number }[]>();
  for (const r of rs2.rows) {
    const id = r.session_id as number;
    const lista = porSessao.get(id) ?? [];
    lista.push({ reps: r.reps as number, peso_kg: r.peso_kg as number });
    porSessao.set(id, lista);
  }

  return sessoes.map((s) => ({ data: s.data, sets: porSessao.get(s.id) ?? [] }));
}
```

E no topo do arquivo, junto dos outros imports de tipo:

```ts
import type { SessaoAnterior } from "../domain/prescricao";
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- --run src/repositories/workouts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/workouts.ts src/repositories/workouts.test.ts
git commit -m "feat(treino): histórico do exercício como insumo da prescrição"
```

---

**Nota de continuidade:** as Tasks 8 a 13 (repositório da sessão, hooks, as três telas e a limpeza) estão em `docs/superpowers/plans/2026-08-17-treino-rotina-parte-2.md`. Dividido em dois arquivos por tamanho, não por escopo — a Task 8 começa exatamente onde a 7 parou.
