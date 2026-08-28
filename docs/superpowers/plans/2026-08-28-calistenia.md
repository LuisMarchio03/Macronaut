# Módulo de calistenia — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:executing-plans`
> (ou `superpowers:subagent-driven-development`) para tocar tarefa a tarefa.
> Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** registrar em dois toques as séries soltas que acontecem ao longo
do dia (flexões, agachamentos, prancha), e responder com número se elas estão
ajudando no objetivo.

**Arquitetura:** tabela própria (`calistenia_sets`) referenciando o catálogo de
`exercises` que já existe; domínio puro converte série em volume, caloria e
tendência; a caloria entra no balanço energético da `/analise` calculada na
leitura, sem gravar em `activity_sessions`.

**Stack:** React 19, TanStack Query 5, Turso/libSQL, Tailwind 4, Vitest 4 +
Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-28-calistenia-design.md`

## Restrições globais

- **Tudo em português** — nomes de função, variáveis, comentários, textos de
  tela e mensagens de commit. É a língua do repositório inteiro.
- **Comentário explica o PORQUÊ**, nunca o quê. O código já diz o quê.
- **`src/domain/` é puro:** sem banco, sem React, sem `Date.now()`. A data de
  hoje entra por argumento. (Exceção já existente no repo: importar
  `horaParaMinutos` de `lib/date`.)
- **`src/repositories/` é a única camada que escreve SQL.** Toda função recebe
  `db: Client` e `userId: number`, e todo `WHERE` filtra por `user_id`.
- **TDD sem exceção:** teste primeiro, ver falhar, implementar o mínimo, ver
  passar, commitar.
- **Alvo de toque de 44px** (WCAG 2.5.8) em qualquer controle novo.
- **Coluna nova em tabela que já existe vai em `ADDITIVE_COLUMNS`** de
  `scripts/lib/apply-schema.ts`, nunca em `schema.sql` — num banco em uso o
  `CREATE TABLE IF NOT EXISTS` é no-op e a coluna nunca apareceria.
- Rodar a suíte: `npm test`. Um arquivo: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run <caminho>`.
- Tipos: `npx tsc -b`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/db/schema.sql` | + `calistenia_sets`, `calistenia_metas` |
| `scripts/lib/apply-schema.ts` | + colunas aditivas `exercises.fracao_corporal` e `exercises.medida` |
| `scripts/lib/limpar-dados.ts` | + as duas tabelas novas como dado de uso |
| `src/db/catalogo-exercicios.ts` | + campos `fracao`/`met`/`medida` nas entradas de peso corporal, + 5 movimentos que faltam |
| `src/repositories/exercises.ts` | `seedExercicios` passa a gravar as colunas novas |
| `src/domain/types.ts` | `Exercise` ganha `fracao_corporal` e `medida` |
| `src/domain/calistenia.ts` | **novo** — volume, caloria, totais, recorde, sequência, tendência. Puro. |
| `src/repositories/calistenia.ts` | **novo** — todo o SQL do módulo |
| `src/hooks/use-calistenia.ts` | **novo** — wrappers do TanStack Query |
| `src/components/calistenia/sheet-registrar.tsx` | **novo** — a folha de registro (stepper) |
| `src/components/calistenia/card-hoje.tsx` | **novo** — o card compartilhado por Dashboard e aba Hoje |
| `src/pages/treino-calistenia.tsx` | **novo** — `/treino/calistenia`, três visões |
| `src/App.tsx` | + a rota |
| `src/pages/treino-layout.tsx` | `alias` da aba Hoje passa a acender em `/treino/calistenia` |
| `src/pages/dashboard.tsx`, `src/pages/treino.tsx` | montam o card |
| `src/pages/analise.tsx` | soma a kcal da calistenia ao gasto e ao balanço |

---

## Task 1: Schema, colunas aditivas e limpeza

**Arquivos:**
- Modificar: `src/db/schema.sql` (fim do arquivo)
- Modificar: `scripts/lib/apply-schema.ts` (`ADDITIVE_COLUMNS`)
- Modificar: `scripts/lib/limpar-dados.ts` (lista de tabelas)
- Teste: `scripts/lib/limpar-dados.test.ts`

**Interfaces:**
- Consome: nada.
- Produz: as tabelas `calistenia_sets` e `calistenia_metas`, e as colunas
  `exercises.fracao_corporal` (REAL) e `exercises.medida` (TEXT) — usadas por
  todas as tarefas seguintes.

- [ ] **Passo 1: escrever o teste que falha**

Em `scripts/lib/limpar-dados.test.ts`, no helper que povoa todas as tabelas,
acrescentar:

```ts
await db.execute({
  sql: `INSERT INTO calistenia_sets (user_id, data, exercise_id, reps, segundos, created_at)
        VALUES (?, '2026-08-28', 1, 20, NULL, 't')`,
  args: [userId],
});
await db.execute({
  sql: "INSERT INTO calistenia_metas (user_id, exercise_id, alvo_dia) VALUES (?, 1, 100)",
  args: [userId],
});
```

E acrescentar `"calistenia_sets"` e `"calistenia_metas"` à lista de tabelas que
o teste confere ficarem vazias depois da limpeza.

- [ ] **Passo 2: rodar e ver falhar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run scripts/lib/limpar-dados.test.ts`
Esperado: FALHA com "no such table: calistenia_sets".

- [ ] **Passo 3: criar as tabelas**

No fim de `src/db/schema.sql`:

```sql
-- ═══════════════════════════════════════════════════════════════════
-- CALISTENIA
--
-- O terceiro modo de treino: séries soltas ao longo do dia, sem sessão.
-- Tabela própria e não `workout_sets` de propósito — aquela exige
-- `session_id`, e uma sessão-fantasma por dia poluiria o histórico de
-- sessões, rebaixaria a carga da dupla progressão (`ultimaVezExercicio`
-- leria peso corporal como 0 kg) e contaria como dia treinado na
-- consistência da rotina. Ver spec 2026-08-28, decisão D1.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS calistenia_sets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  data           TEXT NOT NULL,              -- 'YYYY-MM-DD'
  exercise_id    INTEGER NOT NULL,
  reps           INTEGER CHECK (reps IS NULL OR reps > 0),
  segundos       INTEGER CHECK (segundos IS NULL OR segundos > 0),
  peso_extra_kg  REAL,                       -- colete, anilha; NULL = só o corpo
  -- A HORA é dado, não metadado: é ela que responde "quando eu faço isso?".
  created_at     TEXT NOT NULL,
  -- Uma medida por série, e exatamente uma: flexão se conta em repetições,
  -- prancha em segundos, e converter uma na outra mentiria no que foi digitado.
  CHECK ((reps IS NULL) <> (segundos IS NULL)),
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
CREATE INDEX IF NOT EXISTS idx_calistenia_user_data ON calistenia_sets (user_id, data);

-- Meta diária, opcional. Ausência de linha = exercício sem meta.
CREATE TABLE IF NOT EXISTS calistenia_metas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  exercise_id  INTEGER NOT NULL,
  alvo_dia     INTEGER NOT NULL CHECK (alvo_dia > 0),  -- reps ou segundos, conforme o exercício
  UNIQUE (user_id, exercise_id),
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
```

- [ ] **Passo 4: colunas aditivas**

Em `scripts/lib/apply-schema.ts`, no fim de `ADDITIVE_COLUMNS`:

```ts
  // Que fração do peso do corpo o movimento levanta: flexão ≈ 0,64, barra
  // fixa ≈ 1,00. É o que converte "40 flexões" em volume comparável ao da
  // musculação. NULL nos exercícios em que a pergunta não faz sentido.
  { table: "exercises", column: "fracao_corporal", ddl: "ALTER TABLE exercises ADD COLUMN fracao_corporal REAL" },
  // 'reps' | 'segundos'. Prancha se mede em segundos, e a folha de registro
  // precisa saber disso ANTES de o usuário digitar. NULL = reps.
  { table: "exercises", column: "medida", ddl: "ALTER TABLE exercises ADD COLUMN medida TEXT" },
```

- [ ] **Passo 5: incluir na limpeza**

Em `scripts/lib/limpar-dados.ts`, junto das outras tabelas de dado de uso:

```ts
  { tabela: "calistenia_sets", onde: "user_id IN (U)" },
  // Meta é configuração do usuário, não catálogo: recomeçar do zero apaga.
  { tabela: "calistenia_metas", onde: "user_id IN (U)" },
```

- [ ] **Passo 6: rodar e ver passar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run scripts/lib/limpar-dados.test.ts scripts/lib/apply-schema.test.ts`
Esperado: PASSA.

- [ ] **Passo 7: commit**

```bash
git add src/db/schema.sql scripts/lib/apply-schema.ts scripts/lib/limpar-dados.ts scripts/lib/limpar-dados.test.ts
git commit -m "feat(calistenia): tabelas da série avulsa e as colunas que o catálogo precisa"
```

---

## Task 2: Catálogo — fração corporal, MET e os movimentos que faltam

**Arquivos:**
- Modificar: `src/db/catalogo-exercicios.ts`
- Modificar: `src/db/catalogo-exercicios.test.ts`
- Modificar: `src/repositories/exercises.ts` (`seedExercicios`, mapeamento de linha)
- Modificar: `src/domain/types.ts` (`Exercise`)

**Interfaces:**
- Consome: as colunas da Task 1.
- Produz: `Exercise.fracao_corporal: number | null` e
  `Exercise.medida: "reps" | "segundos" | null`; 37 exercícios de peso corporal
  com fração e MET semeados.

- [ ] **Passo 1: escrever o teste que falha**

Em `src/db/catalogo-exercicios.test.ts`:

```ts
// A calistenia mede volume por fração do peso do corpo e caloria por MET.
// Um exercício de peso corporal sem os dois entra no módulo como um buraco:
// aparece na lista e não soma em número nenhum.
it("todo exercício de peso corporal tem fração corporal e MET", () => {
  const sem = CATALOGO.filter(
    (e) => e.equipamento === "peso_corporal" && (e.fracao === undefined || e.met === undefined),
  );
  expect(sem.map((e) => e.nome)).toEqual([]);
});

it("a fração corporal fica entre 0 e 1", () => {
  for (const e of CATALOGO) {
    if (e.fracao === undefined) continue;
    expect(e.fracao).toBeGreaterThan(0);
    expect(e.fracao).toBeLessThanOrEqual(1);
  }
});

// Agachamento, flexão e abdominal são os três que o pedido cita nominalmente.
// O único agachamento de peso corporal do catálogo era o sissy, que não é o
// que se faz solto na sala.
it("tem os movimentos de peso corporal que se faz solto no dia", () => {
  const nomes = CATALOGO.map((e) => e.nome);
  for (const n of [
    "Agachamento livre sem peso", "Afundo sem peso", "Burpee",
    "Polichinelo", "Agachamento com salto",
  ]) {
    expect(nomes).toContain(n);
  }
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/db/catalogo-exercicios.test.ts`
Esperado: FALHA — `e.fracao` não existe no tipo, e os cinco nomes não estão no catálogo.

- [ ] **Passo 3: estender `ItemCatalogo`**

Em `src/db/catalogo-exercicios.ts`, na interface `ItemCatalogo`:

```ts
  /**
   * Que fração do peso do corpo o movimento levanta. Flexão ≈ 0,64 (o resto
   * apoia nos pés), barra fixa = 1,00 (o corpo inteiro pendurado).
   *
   * É uma ESTIMATIVA de literatura, e serve a uma comparação relativa — "esta
   * semana movi mais que a passada" —, não a um número absoluto de fisiologia.
   * Só nos exercícios de peso corporal: em barra e máquina a carga é o dado.
   */
  fracao?: number;
  /**
   * MET do movimento, para a estimativa de caloria da calistenia.
   *
   * Semear MET em exercício de peso corporal é seguro: cardio é reconhecido
   * por `equipamento === 'cardio'` (em `montarItemAvulso`) e por
   * `duracao_min IS NOT NULL` (em `ehCardio`), nunca pela presença de MET.
   */
  met?: number;
  /** 'segundos' nos isométricos. Ausente = repetições. */
  medida?: "segundos";
```

- [ ] **Passo 4: preencher os 32 que já existem**

Acrescentar `fracao` e `met` a cada entrada `equipamento: "peso_corporal"`, na
linha logo abaixo de `nome/grupo/tipo/equipamento`. Valores (MET 8,0 é
"calisthenics, vigorous effort" do Compendium; 3,8 é a versão leve):

| Exercício | `fracao` | `met` | `medida` |
|---|---|---|---|
| Flexão de braço | 0.64 | 8 | |
| Flexão inclinada | 0.55 | 5.5 | |
| Flexão diamante | 0.70 | 8 | |
| Paralelas | 1.00 | 8 | |
| Barra fixa pronada | 1.00 | 8 | |
| Barra fixa supinada | 1.00 | 8 | |
| Barra fixa neutra | 1.00 | 8 | |
| Remada australiana | 0.55 | 5.5 | |
| Mergulho no banco | 0.55 | 5.5 | |
| Paralelas para tríceps | 1.00 | 8 | |
| Hiperextensão lombar | 0.45 | 3.8 | |
| Elevação pélvica unilateral | 0.40 | 3.8 | |
| Ponte de glúteo | 0.35 | 3.8 | |
| Abdominal supra no solo | 0.35 | 3.8 | |
| Abdominal infra no banco | 0.40 | 3.8 | |
| Elevação de pernas suspenso | 0.45 | 5.5 | |
| Elevação de pernas no solo | 0.40 | 3.8 | |
| Prancha | 0.60 | 3.8 | `"segundos"` |
| Prancha lateral | 0.55 | 3.8 | `"segundos"` |
| Rotação russa | 0.30 | 3.8 | |
| Roda abdominal | 0.55 | 5.5 | |
| Escalador | 0.60 | 8 | |
| Flexão com os pés elevados | 0.70 | 8 | |
| Agachamento sissy | 0.65 | 5.5 | |
| Flexora nórdica | 0.75 | 5.5 | |
| Abdução deitado de lado | 0.20 | 3.8 | |
| Abdominal bicicleta | 0.35 | 5.5 | |
| Dead bug | 0.25 | 3.8 | |
| Prancha alta | 0.55 | 3.8 | `"segundos"` |
| Encolhimento na barra fixa | 1.00 | 3.8 | |
| Rolo de punho | 0.05 | 3.8 | |
| Pegada isométrica na barra | 1.00 | 3.8 | `"segundos"` |

- [ ] **Passo 5: acrescentar os cinco movimentos que faltam**

No fim de `CATALOGO`:

```ts
  {
    nome: "Agachamento livre sem peso", grupo: "Quadríceps", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.65, met: 5.5,
    secundarios: ["Glúteos", "Posterior", "Core"],
    aliases: ["agachamento", "air squat", "agachamento livre"],
    instrucoes: [
      "Pés na largura dos ombros, pontas levemente para fora.",
      "Desça empurrando o quadril para trás, joelho acompanhando a linha do pé.",
      "Desça até a coxa passar da paralela, se o tornozelo deixar; suba pelo calcanhar.",
    ],
  },
  {
    nome: "Afundo sem peso", grupo: "Quadríceps", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.65, met: 5.5,
    secundarios: ["Glúteos", "Posterior"],
    aliases: ["afundo", "avanço", "lunge"],
    instrucoes: [
      "Passo à frente firme; o tronco fica ereto, não se inclina para a perna da frente.",
      "Desça até o joelho de trás quase tocar o chão.",
      "Volte empurrando o calcanhar da perna da frente.",
    ],
  },
  {
    nome: "Burpee", grupo: "Core", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.70, met: 8,
    secundarios: ["Peito", "Quadríceps", "Ombros"],
    aliases: ["burpees"],
    instrucoes: [
      "Do agachamento, jogue os pés para trás e caia na posição de flexão.",
      "Faça a flexão (ou pule ela, se o objetivo é ritmo), volte os pés ao agachamento.",
      "Termine com um salto e as mãos acima da cabeça.",
    ],
  },
  {
    nome: "Polichinelo", grupo: "Panturrilha", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.15, met: 8,
    secundarios: ["Ombros"],
    aliases: ["jumping jack", "polichinelos"],
    instrucoes: [
      "Salte abrindo as pernas e levando as mãos acima da cabeça.",
      "Volte no mesmo salto, sem travar o joelho na aterrissagem.",
    ],
  },
  {
    nome: "Agachamento com salto", grupo: "Quadríceps", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.75, met: 8,
    secundarios: ["Glúteos", "Panturrilha"],
    aliases: ["jump squat", "agachamento pliométrico"],
    instrucoes: [
      "Agache até a coxa perto da paralela e salte com força.",
      "Aterrisse na ponta do pé e desça para o próximo agachamento absorvendo o impacto.",
    ],
  },
```

- [ ] **Passo 6: gravar as colunas no seed**

Em `src/repositories/exercises.ts`, dentro de `seedExercicios`, incluir os três
campos no `INSERT` e no `UPDATE`:

```ts
    return id === undefined
      ? {
          sql: `INSERT INTO exercises
                  (user_id, nome, grupo_id, source, tipo, equipamento,
                   musculos_secundarios, aliases, instrucoes, met, fracao_corporal, medida, created_at)
                VALUES (NULL, ?, ?, 'catalogo', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [e.nome, gid, e.tipo, e.equipamento, secundarios, aliases, instrucoes,
                 e.met ?? null, e.fracao ?? null, e.medida ?? null, created_at],
        }
      : {
          sql: `UPDATE exercises
                SET grupo_id=?, tipo=?, equipamento=?,
                    musculos_secundarios=?, aliases=?, instrucoes=?,
                    fracao_corporal=?, medida=?
                WHERE id=? AND source='catalogo'`,
          args: [gid, e.tipo, e.equipamento, secundarios, aliases, instrucoes,
                 e.fracao ?? null, e.medida ?? null, id],
        };
```

**Atenção:** o `UPDATE` NÃO escreve `met`. `seedExerciciosDeCardio` semeia o MET
do cardio por outro caminho, e sobrescrevê-lo aqui com `null` apagaria o MET de
toda bicicleta já cadastrada. Para os de peso corporal, o MET entra no `INSERT`
de quem é novo e num backfill à parte de quem já existe:

```ts
/** Preenche MET e fração dos exercícios de peso corporal que já existiam antes
 *  da calistenia. Só onde está NULL — nunca sobrescreve o que já tem valor. */
export async function backfillCalistenia(db: Client): Promise<number> {
  let n = 0;
  for (const e of CATALOGO) {
    if (e.equipamento !== "peso_corporal") continue;
    const rs = await db.execute({
      sql: `UPDATE exercises SET met = COALESCE(met, ?), fracao_corporal = COALESCE(fracao_corporal, ?)
            WHERE nome = ? AND source = 'catalogo'`,
      args: [e.met ?? null, e.fracao ?? null, e.nome],
    });
    n += rs.rowsAffected;
  }
  return n;
}
```

Chamar `backfillCalistenia(db)` em `scripts/setup-db.ts`, depois de
`seedExercicios(db)`.

- [ ] **Passo 7: expor no tipo `Exercise` e no mapeamento**

Em `src/domain/types.ts`, na interface `Exercise`, depois de `met`:

```ts
  /** Fração do peso do corpo que o movimento levanta. Só em peso corporal. */
  fracao_corporal: number | null;
  /** 'reps' | 'segundos'. NULL = repetições. */
  medida: "reps" | "segundos" | null;
```

Em `src/repositories/exercises.ts`, na função que mapeia a linha para
`Exercise`, acrescentar:

```ts
    fracao_corporal: (r.fracao_corporal as number | null) ?? null,
    medida: (r.medida as "reps" | "segundos" | null) ?? null,
```

- [ ] **Passo 8: rodar e ver passar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/db/catalogo-exercicios.test.ts src/repositories/exercises.test.ts`
Esperado: PASSA. Depois `npx tsc -b` sem erro.

- [ ] **Passo 9: commit**

```bash
git add src/db/catalogo-exercicios.ts src/db/catalogo-exercicios.test.ts src/repositories/exercises.ts src/domain/types.ts scripts/setup-db.ts
git commit -m "feat(calistenia): catálogo ganha fração corporal, MET e os movimentos soltos"
```

---

## Task 3: Domínio

**Arquivos:**
- Criar: `src/domain/calistenia.ts`
- Criar: `src/domain/calistenia.test.ts`

**Interfaces:**
- Consome: `estimativaKcal` de `src/domain/treino.ts`.
- Produz: `SerieAvulsa`, `Medida`, `TotaisDoDia`, `TotalPorExercicio`, e as
  funções `medidaDa`, `quantidadeDa`, `volumeEquivalente`, `segundosDeEsforco`,
  `kcalDaSerie`, `totaisPorDia`, `totaisPorExercicio`, `kcalPorDia`,
  `recordeDeSerie`, `sequenciaDeDias`, `tendencia`, e as constantes
  `SEGUNDOS_POR_REP`, `MET_PADRAO`, `FRACAO_PADRAO`.

- [ ] **Passo 1: escrever o teste que falha**

`src/domain/calistenia.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  kcalDaSerie, kcalPorDia, medidaDa, quantidadeDa, recordeDeSerie, segundosDeEsforco,
  sequenciaDeDias, tendencia, totaisPorDia, totaisPorExercicio, volumeEquivalente,
  type SerieAvulsa,
} from "./calistenia";

const PESO = 80;

function serie(p: Partial<SerieAvulsa> = {}): SerieAvulsa {
  return {
    id: 1, data: "2026-08-28", created_at: "2026-08-28T10:00:00.000Z",
    exercise_id: 1, nome: "Flexão de braço", grupo: "Peito",
    reps: 20, segundos: null, peso_extra_kg: null,
    fracao_corporal: 0.64, met: 8,
    ...p,
  };
}

describe("medida da série", () => {
  it("com segundos é isometria", () => {
    expect(medidaDa(serie({ reps: null, segundos: 60 }))).toBe("segundos");
  });
  it("com reps é repetição", () => {
    expect(medidaDa(serie())).toBe("reps");
  });
  it("a quantidade é a medida que a série tem", () => {
    expect(quantidadeDa(serie())).toBe(20);
    expect(quantidadeDa(serie({ reps: null, segundos: 45 }))).toBe(45);
  });
});

describe("volumeEquivalente", () => {
  // 20 flexões de um corpo de 80 kg movem 0,64 × 80 = 51,2 kg por repetição.
  it("é a fração do corpo vezes as repetições", () => {
    expect(volumeEquivalente(serie(), PESO)).toBeCloseTo(1024, 1);
  });

  it("o peso extra entra por cima do corpo", () => {
    expect(volumeEquivalente(serie({ reps: 10, peso_extra_kg: 10 }), PESO)).toBeCloseTo(612, 1);
  });

  // Isometria não tem repetição, e inventar uma para gerar volume seria
  // devolver um número que ninguém pode conferir.
  it("isometria não gera volume em kg", () => {
    expect(volumeEquivalente(serie({ reps: null, segundos: 60 }), PESO)).toBe(0);
  });

  it("exercício sem fração medida usa a fração padrão", () => {
    expect(volumeEquivalente(serie({ reps: 10, fracao_corporal: null }), PESO)).toBeCloseTo(400, 1);
  });
});

describe("segundosDeEsforco", () => {
  it("isometria são os próprios segundos", () => {
    expect(segundosDeEsforco(serie({ reps: null, segundos: 45 }))).toBe(45);
  });
  it("repetição vira tempo pela estimativa de 3s por rep", () => {
    expect(segundosDeEsforco(serie({ reps: 20 }))).toBe(60);
  });
});

describe("kcalDaSerie", () => {
  // MET 8, 80 kg, 60 s = 8 × 80 × (1/60) h = 10,67 kcal.
  it("é a mesma conta do cardio: MET × peso × horas", () => {
    expect(kcalDaSerie(serie(), PESO)).toBeCloseTo(10.67, 1);
  });
  it("exercício sem MET usa o MET padrão da calistenia", () => {
    expect(kcalDaSerie(serie({ met: null }), PESO)).toBeCloseTo(10.67, 1);
  });
});

describe("totaisPorDia", () => {
  it("soma reps, segundos, volume e caloria por dia", () => {
    const totais = totaisPorDia(
      [
        serie({ id: 1, data: "2026-08-28", reps: 20 }),
        serie({ id: 2, data: "2026-08-28", reps: 15 }),
        serie({ id: 3, data: "2026-08-27", reps: null, segundos: 60 }),
      ],
      PESO,
    );

    expect(totais.get("2026-08-28")!.reps).toBe(35);
    expect(totais.get("2026-08-28")!.nSeries).toBe(2);
    expect(totais.get("2026-08-27")!.segundos).toBe(60);
    expect(totais.get("2026-08-27")!.reps).toBe(0);
  });
});

describe("totaisPorExercicio", () => {
  it("agrupa por exercício e traz o recorde de série única", () => {
    const linhas = totaisPorExercicio(
      [
        serie({ id: 1, exercise_id: 1, reps: 20 }),
        serie({ id: 2, exercise_id: 1, reps: 30 }),
        serie({ id: 3, exercise_id: 2, nome: "Prancha", reps: null, segundos: 60 }),
      ],
      PESO,
    );

    const flexao = linhas.find((l) => l.exercise_id === 1)!;
    expect(flexao.quantidade).toBe(50);
    expect(flexao.recorde).toBe(30);
    expect(flexao.medida).toBe("reps");
    expect(linhas.find((l) => l.exercise_id === 2)!.medida).toBe("segundos");
  });

  it("o exercício de maior volume vem primeiro", () => {
    const linhas = totaisPorExercicio(
      [
        serie({ id: 1, exercise_id: 1, reps: 5 }),
        serie({ id: 2, exercise_id: 2, nome: "Agachamento", reps: 100 }),
      ],
      PESO,
    );
    expect(linhas[0].exercise_id).toBe(2);
  });
});

describe("kcalPorDia", () => {
  it("é o mapa que a análise soma ao gasto do cardio", () => {
    const m = kcalPorDia([serie({ id: 1, data: "2026-08-28" })], PESO);
    expect(m.get("2026-08-28")).toBeCloseTo(10.67, 1);
  });
});

describe("recordeDeSerie", () => {
  it("é a maior série única do exercício", () => {
    expect(
      recordeDeSerie(
        [serie({ id: 1, reps: 20 }), serie({ id: 2, reps: 32 }), serie({ id: 3, exercise_id: 9, reps: 99 })],
        1,
      ),
    ).toBe(32);
  });
  it("sem série do exercício não há recorde", () => {
    expect(recordeDeSerie([], 1)).toBeNull();
  });
});

describe("sequenciaDeDias", () => {
  it("conta os dias seguidos até hoje", () => {
    expect(sequenciaDeDias(["2026-08-26", "2026-08-27", "2026-08-28"], "2026-08-28")).toBe(3);
  });

  // Às 8h da manhã você ainda não fez nada, e zerar a sequência de 12 dias
  // nesse momento é punir o usuário pelo relógio.
  it("hoje ainda vazio não quebra a sequência que vinha de ontem", () => {
    expect(sequenciaDeDias(["2026-08-26", "2026-08-27"], "2026-08-28")).toBe(2);
  });

  it("um dia pulado quebra a sequência", () => {
    expect(sequenciaDeDias(["2026-08-24", "2026-08-27", "2026-08-28"], "2026-08-28")).toBe(2);
  });

  it("sem registro nenhum a sequência é zero", () => {
    expect(sequenciaDeDias([], "2026-08-28")).toBe(0);
  });

  it("o mesmo dia repetido conta uma vez", () => {
    expect(sequenciaDeDias(["2026-08-28", "2026-08-28"], "2026-08-28")).toBe(1);
  });
});

describe("tendencia", () => {
  it("é a variação percentual entre os dois períodos", () => {
    expect(tendencia(120, 100)).toBeCloseTo(20, 5);
    expect(tendencia(80, 100)).toBeCloseTo(-20, 5);
  });

  // "+∞%" não é uma tendência, é uma divisão por zero na tela.
  it("sem base não há tendência", () => {
    expect(tendencia(50, 0)).toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/domain/calistenia.test.ts`
Esperado: FALHA — o módulo `./calistenia` não existe.

- [ ] **Passo 3: implementar**

`src/domain/calistenia.ts`:

```ts
import { estimativaKcal } from "./treino";

/**
 * CALISTENIA — a série que acontece fora da sessão.
 *
 * Puro: recebe as séries e o peso corporal, devolve números. Nada aqui conhece
 * React, banco ou relógio — a data de hoje entra por argumento, porque uma
 * função que lê o relógio não se testa.
 */

/** Quanto tempo uma repetição leva. Estimativa, e a tela a rotula como tal. */
export const SEGUNDOS_POR_REP = 3;
/** "Calisthenics, vigorous effort" do Compendium of Physical Activities. */
export const MET_PADRAO = 8;
/** Exercício sem fração medida: metade do corpo. Conservador de propósito. */
export const FRACAO_PADRAO = 0.5;

const DIA_MS = 86_400_000;

/** Constrói a data no fuso local. Duplicado de `consistencia.ts` pela mesma
 *  razão que lá: `domain/` não recebe `Date` já construída em toda chamada. */
function local(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Medida = "reps" | "segundos";

export interface SerieAvulsa {
  id: number;
  data: string;
  /** A hora em que aconteceu. É dado: responde "quando eu faço isso?". */
  created_at: string;
  exercise_id: number;
  nome: string;
  grupo: string | null;
  reps: number | null;
  segundos: number | null;
  peso_extra_kg: number | null;
  fracao_corporal: number | null;
  met: number | null;
}

export interface TotaisDoDia {
  data: string;
  reps: number;
  segundos: number;
  volume_kg: number;
  kcal: number;
  nSeries: number;
}

export interface TotalPorExercicio {
  exercise_id: number;
  nome: string;
  medida: Medida;
  /** Reps somadas, ou segundos somados — conforme `medida`. */
  quantidade: number;
  nSeries: number;
  volume_kg: number;
  kcal: number;
  /** A maior série única. É o "1RM" da calistenia. */
  recorde: number;
}

export function medidaDa(s: SerieAvulsa): Medida {
  return s.segundos !== null ? "segundos" : "reps";
}

export function quantidadeDa(s: SerieAvulsa): number {
  return s.segundos ?? s.reps ?? 0;
}

/**
 * Carga movida: a fração do corpo que o movimento levanta, mais o que estiver
 * pendurado nele, vezes as repetições.
 *
 * Isometria devolve zero: não há repetição, e inventar uma para gerar volume
 * seria devolver um número que ninguém pode conferir. Prancha conta em
 * segundos e em caloria, que é o que ela de fato produz.
 */
export function volumeEquivalente(s: SerieAvulsa, pesoCorporalKg: number): number {
  if (s.reps === null) return 0;
  const carga = (s.fracao_corporal ?? FRACAO_PADRAO) * pesoCorporalKg + (s.peso_extra_kg ?? 0);
  return carga * s.reps;
}

export function segundosDeEsforco(s: SerieAvulsa): number {
  return s.segundos ?? (s.reps ?? 0) * SEGUNDOS_POR_REP;
}

/** A mesma conta do cardio da sessão, para os dois darem o mesmo número no
 *  balanço energético. */
export function kcalDaSerie(s: SerieAvulsa, pesoCorporalKg: number): number {
  return estimativaKcal(s.met ?? MET_PADRAO, pesoCorporalKg, segundosDeEsforco(s) / 60);
}

export function totaisPorDia(
  series: SerieAvulsa[],
  pesoCorporalKg: number,
): Map<string, TotaisDoDia> {
  const m = new Map<string, TotaisDoDia>();
  for (const s of series) {
    const atual = m.get(s.data) ?? {
      data: s.data, reps: 0, segundos: 0, volume_kg: 0, kcal: 0, nSeries: 0,
    };
    atual.reps += s.reps ?? 0;
    atual.segundos += s.segundos ?? 0;
    atual.volume_kg += volumeEquivalente(s, pesoCorporalKg);
    atual.kcal += kcalDaSerie(s, pesoCorporalKg);
    atual.nSeries += 1;
    m.set(s.data, atual);
  }
  return m;
}

/** Do que mais moveu para o que menos: é a ordem em que a pergunta "o que eu
 *  ando fazendo?" quer ser respondida. */
export function totaisPorExercicio(
  series: SerieAvulsa[],
  pesoCorporalKg: number,
): TotalPorExercicio[] {
  const m = new Map<number, TotalPorExercicio>();
  for (const s of series) {
    const atual = m.get(s.exercise_id) ?? {
      exercise_id: s.exercise_id, nome: s.nome, medida: medidaDa(s),
      quantidade: 0, nSeries: 0, volume_kg: 0, kcal: 0, recorde: 0,
    };
    const q = quantidadeDa(s);
    atual.quantidade += q;
    atual.nSeries += 1;
    atual.volume_kg += volumeEquivalente(s, pesoCorporalKg);
    atual.kcal += kcalDaSerie(s, pesoCorporalKg);
    atual.recorde = Math.max(atual.recorde, q);
    m.set(s.exercise_id, atual);
  }
  return [...m.values()].sort((a, b) => b.volume_kg - a.volume_kg || b.quantidade - a.quantidade);
}

export function kcalPorDia(series: SerieAvulsa[], pesoCorporalKg: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of series) {
    m.set(s.data, (m.get(s.data) ?? 0) + kcalDaSerie(s, pesoCorporalKg));
  }
  return m;
}

export function recordeDeSerie(series: SerieAvulsa[], exerciseId: number): number | null {
  const doExercicio = series.filter((s) => s.exercise_id === exerciseId).map(quantidadeDa);
  return doExercicio.length === 0 ? null : Math.max(...doExercicio);
}

/**
 * Dias seguidos com registro, contando para trás.
 *
 * Começa em `hoje`; se hoje ainda está vazio, começa em ontem — às 8h da manhã
 * você ainda não fez nada, e zerar a sequência de 12 dias nesse momento é
 * punir o usuário pelo relógio, não medir o hábito dele.
 */
export function sequenciaDeDias(datas: string[], hoje: string): number {
  const comRegistro = new Set(datas);
  if (comRegistro.size === 0) return 0;

  const inicio = comRegistro.has(hoje) ? local(hoje) : new Date(local(hoje).getTime() - DIA_MS);
  let n = 0;
  let cursor = inicio;
  while (comRegistro.has(iso(cursor))) {
    n += 1;
    cursor = new Date(cursor.getTime() - DIA_MS);
  }
  return n;
}

/** Variação percentual entre dois períodos. `null` quando a base é zero:
 *  "+∞%" não é uma tendência, é uma divisão por zero na tela. */
export function tendencia(atual: number, base: number): number | null {
  if (base === 0) return null;
  return ((atual - base) / base) * 100;
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/domain/calistenia.test.ts`
Esperado: PASSA (todos).

- [ ] **Passo 5: commit**

```bash
git add src/domain/calistenia.ts src/domain/calistenia.test.ts
git commit -m "feat(calistenia): domínio — volume equivalente, caloria, recorde e sequência"
```

---

## Task 4: Repositório

**Arquivos:**
- Criar: `src/repositories/calistenia.ts`
- Criar: `src/repositories/calistenia.test.ts`

**Interfaces:**
- Consome: `SerieAvulsa` e `Medida` de `src/domain/calistenia.ts`.
- Produz: `registrarSerie`, `apagarSerie`, `seriesDoDia`, `seriesPorRange`,
  `exerciciosDeCalistenia`, `usadosRecentemente`, `listarMetas`, `salvarMeta`,
  `apagarMeta`, e os tipos `RegistroCalistenia`, `ExercicioDeCalistenia`,
  `UsoRecente`, `MetaCalistenia`.

- [ ] **Passo 1: escrever o teste que falha**

`src/repositories/calistenia.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  apagarMeta, apagarSerie, exerciciosDeCalistenia, listarMetas, registrarSerie,
  salvarMeta, seriesDoDia, seriesPorRange, usadosRecentemente,
} from "./calistenia";

const USER = 1;
const OUTRO = 2;
let db: Client;

async function exercicio(
  nome: string,
  extras: { fracao?: number; met?: number; medida?: string; equipamento?: string } = {},
): Promise<number> {
  const rs = await db.execute({
    sql: `INSERT INTO exercises
            (user_id, nome, source, equipamento, met, fracao_corporal, medida, created_at)
          VALUES (NULL, ?, 'catalogo', ?, ?, ?, ?, 't')`,
    args: [
      nome,
      extras.equipamento ?? "peso_corporal",
      extras.met ?? 8,
      extras.fracao ?? 0.64,
      extras.medida ?? null,
    ],
  });
  return Number(rs.lastInsertRowid);
}

beforeEach(async () => { db = await createTestDb(); });

describe("registrarSerie", () => {
  it("grava as repetições e traz a ficha do exercício junto na leitura", async () => {
    const flexao = await exercicio("Flexão de braço");

    await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });

    const series = await seriesDoDia(db, USER, "2026-08-28");
    expect(series).toHaveLength(1);
    expect(series[0].nome).toBe("Flexão de braço");
    expect(series[0].reps).toBe(20);
    expect(series[0].fracao_corporal).toBeCloseTo(0.64, 2);
    expect(series[0].met).toBe(8);
  });

  it("grava isometria em segundos", async () => {
    const prancha = await exercicio("Prancha", { medida: "segundos" });

    await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: prancha, reps: null, segundos: 60, peso_extra_kg: null,
    });

    const [s] = await seriesDoDia(db, USER, "2026-08-28");
    expect(s.segundos).toBe(60);
    expect(s.reps).toBeNull();
  });

  // O CHECK do schema é o que impede uma série de dizer duas coisas ao mesmo
  // tempo — e uma que não diz nenhuma não é série.
  it("recusa série sem medida nenhuma", async () => {
    const flexao = await exercicio("Flexão de braço");
    await expect(
      registrarSerie(db, USER, {
        data: "2026-08-28", exercise_id: flexao, reps: null, segundos: null, peso_extra_kg: null,
      }),
    ).rejects.toThrow();
  });

  it("recusa série com as duas medidas", async () => {
    const flexao = await exercicio("Flexão de braço");
    await expect(
      registrarSerie(db, USER, {
        data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: 60, peso_extra_kg: null,
      }),
    ).rejects.toThrow();
  });

  it("uma série de um usuário não aparece para o outro", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    expect(await seriesDoDia(db, OUTRO, "2026-08-28")).toHaveLength(0);
  });
});

describe("apagarSerie", () => {
  it("tira a série do dia", async () => {
    const flexao = await exercicio("Flexão de braço");
    const id = await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });

    await apagarSerie(db, USER, id);

    expect(await seriesDoDia(db, USER, "2026-08-28")).toHaveLength(0);
  });

  it("um usuário não apaga a série do outro", async () => {
    const flexao = await exercicio("Flexão de braço");
    const id = await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });

    await apagarSerie(db, OUTRO, id);

    expect(await seriesDoDia(db, USER, "2026-08-28")).toHaveLength(1);
  });
});

describe("seriesPorRange", () => {
  it("filtra pelo período e devolve em ordem cronológica", async () => {
    const flexao = await exercicio("Flexão de braço");
    for (const data of ["2026-08-25", "2026-08-27", "2026-08-30"]) {
      await registrarSerie(db, USER, {
        data, exercise_id: flexao, reps: 10, segundos: null, peso_extra_kg: null,
      });
    }

    const dentro = await seriesPorRange(db, USER, "2026-08-26", "2026-08-28");

    expect(dentro.map((s) => s.data)).toEqual(["2026-08-27"]);
  });
});

describe("exerciciosDeCalistenia", () => {
  it("traz os de peso corporal do catálogo e os próprios do usuário", async () => {
    await exercicio("Flexão de braço");
    await exercicio("Supino reto", { equipamento: "barra" });
    await db.execute({
      sql: `INSERT INTO exercises (user_id, nome, source, equipamento, created_at)
            VALUES (?, 'Flexão na parede', 'custom', 'peso_corporal', 't')`,
      args: [USER],
    });

    const lista = await exerciciosDeCalistenia(db, USER);

    expect(lista.map((e) => e.nome).sort()).toEqual(["Flexão de braço", "Flexão na parede"]);
  });

  it("não traz o exercício próprio de outro usuário", async () => {
    await db.execute({
      sql: `INSERT INTO exercises (user_id, nome, source, equipamento, created_at)
            VALUES (?, 'Flexão do vizinho', 'custom', 'peso_corporal', 't')`,
      args: [OUTRO],
    });
    expect(await exerciciosDeCalistenia(db, USER)).toHaveLength(0);
  });
});

describe("usadosRecentemente", () => {
  // São os chips do card: o que você registra sempre tem que estar a um toque,
  // e a última quantidade é o que o stepper abre preenchido.
  it("ordena por frequência e traz a última quantidade de cada um", async () => {
    const flexao = await exercicio("Flexão de braço");
    const agacho = await exercicio("Agachamento");
    for (const reps of [20, 25, 30]) {
      await registrarSerie(db, USER, {
        data: "2026-08-28", exercise_id: flexao, reps, segundos: null, peso_extra_kg: null,
      });
    }
    await registrarSerie(db, USER, {
      data: "2026-08-28", exercise_id: agacho, reps: 15, segundos: null, peso_extra_kg: null,
    });

    const chips = await usadosRecentemente(db, USER, "2026-08-01", 5);

    expect(chips[0].nome).toBe("Flexão de braço");
    expect(chips[0].vezes).toBe(3);
    expect(chips[0].ultima_qtd).toBe(30);
    expect(chips[1].nome).toBe("Agachamento");
  });

  it("ignora o que ficou fora da janela", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, USER, {
      data: "2026-07-01", exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    expect(await usadosRecentemente(db, USER, "2026-08-01", 5)).toHaveLength(0);
  });
});

describe("metas", () => {
  it("salva, lê e apaga a meta diária", async () => {
    const flexao = await exercicio("Flexão de braço");

    await salvarMeta(db, USER, flexao, 100);
    expect(await listarMetas(db, USER)).toEqual([
      { exercise_id: flexao, nome: "Flexão de braço", medida: "reps", alvo_dia: 100 },
    ]);

    await apagarMeta(db, USER, flexao);
    expect(await listarMetas(db, USER)).toHaveLength(0);
  });

  it("salvar de novo atualiza o alvo em vez de duplicar", async () => {
    const flexao = await exercicio("Flexão de braço");
    await salvarMeta(db, USER, flexao, 100);
    await salvarMeta(db, USER, flexao, 150);

    const metas = await listarMetas(db, USER);
    expect(metas).toHaveLength(1);
    expect(metas[0].alvo_dia).toBe(150);
  });

  it("a meta de um usuário não aparece para o outro", async () => {
    const flexao = await exercicio("Flexão de braço");
    await salvarMeta(db, USER, flexao, 100);
    expect(await listarMetas(db, OUTRO)).toHaveLength(0);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/repositories/calistenia.test.ts`
Esperado: FALHA — o módulo `./calistenia` não existe.

- [ ] **Passo 3: implementar**

`src/repositories/calistenia.ts`:

```ts
import type { Client, Row } from "@libsql/client";
import type { Medida, SerieAvulsa } from "../domain/calistenia";

/**
 * O SQL da calistenia.
 *
 * Toda leitura junta `exercises` para trazer nome, grupo, fração corporal e
 * MET: o domínio recebe a série pronta e não precisa de uma segunda consulta
 * para saber quanto vale uma flexão.
 */

export interface RegistroCalistenia {
  data: string;
  exercise_id: number;
  reps: number | null;
  segundos: number | null;
  peso_extra_kg: number | null;
}

export interface ExercicioDeCalistenia {
  id: number;
  nome: string;
  grupo_nome: string | null;
  aliases: string | null;
  medida: Medida;
  fracao_corporal: number | null;
  met: number | null;
}

export interface UsoRecente {
  exercise_id: number;
  nome: string;
  medida: Medida;
  /** A quantidade da última vez — é com ela que o stepper abre. */
  ultima_qtd: number;
  vezes: number;
}

export interface MetaCalistenia {
  exercise_id: number;
  nome: string;
  medida: Medida;
  alvo_dia: number;
}

const SELECT_SERIE = `
  SELECT c.id, c.data, c.created_at, c.exercise_id, c.reps, c.segundos, c.peso_extra_kg,
         e.nome AS nome, g.nome AS grupo, e.fracao_corporal, e.met
  FROM calistenia_sets c
  JOIN exercises e ON e.id = c.exercise_id
  LEFT JOIN muscle_groups g ON g.id = e.grupo_id
`;

function mapSerie(r: Row): SerieAvulsa {
  return {
    id: r.id as number,
    data: r.data as string,
    created_at: r.created_at as string,
    exercise_id: r.exercise_id as number,
    nome: (r.nome as string | null) ?? "?",
    grupo: (r.grupo as string | null) ?? null,
    reps: (r.reps as number | null) ?? null,
    segundos: (r.segundos as number | null) ?? null,
    peso_extra_kg: (r.peso_extra_kg as number | null) ?? null,
    fracao_corporal: (r.fracao_corporal as number | null) ?? null,
    met: (r.met as number | null) ?? null,
  };
}

function medidaDaColuna(v: unknown): Medida {
  return v === "segundos" ? "segundos" : "reps";
}

export async function registrarSerie(
  db: Client,
  userId: number,
  r: RegistroCalistenia,
): Promise<number> {
  const rs = await db.execute({
    sql: `INSERT INTO calistenia_sets
            (user_id, data, exercise_id, reps, segundos, peso_extra_kg, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId, r.data, r.exercise_id, r.reps, r.segundos, r.peso_extra_kg,
      new Date().toISOString(),
    ],
  });
  return Number(rs.lastInsertRowid);
}

export async function apagarSerie(db: Client, userId: number, id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM calistenia_sets WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

export async function seriesPorRange(
  db: Client,
  userId: number,
  inicio: string,
  fim: string,
): Promise<SerieAvulsa[]> {
  const rs = await db.execute({
    sql: `${SELECT_SERIE}
          WHERE c.user_id = ? AND c.data BETWEEN ? AND ?
          ORDER BY c.data, c.created_at`,
    args: [userId, inicio, fim],
  });
  return rs.rows.map(mapSerie);
}

export async function seriesDoDia(
  db: Client,
  userId: number,
  data: string,
): Promise<SerieAvulsa[]> {
  return seriesPorRange(db, userId, data, data);
}

/** Os de peso corporal do catálogo, mais os que o próprio usuário cadastrou. */
export async function exerciciosDeCalistenia(
  db: Client,
  userId: number,
): Promise<ExercicioDeCalistenia[]> {
  const rs = await db.execute({
    sql: `SELECT e.id, e.nome, e.aliases, g.nome AS grupo_nome,
                 e.medida, e.fracao_corporal, e.met
          FROM exercises e
          LEFT JOIN muscle_groups g ON g.id = e.grupo_id
          WHERE e.equipamento = 'peso_corporal'
            AND (e.user_id IS NULL OR e.user_id = ?)
          ORDER BY e.nome`,
    args: [userId],
  });
  return rs.rows.map((r) => ({
    id: r.id as number,
    nome: r.nome as string,
    aliases: (r.aliases as string | null) ?? null,
    grupo_nome: (r.grupo_nome as string | null) ?? null,
    medida: medidaDaColuna(r.medida),
    fracao_corporal: (r.fracao_corporal as number | null) ?? null,
    met: (r.met as number | null) ?? null,
  }));
}

/**
 * Os exercícios que viraram hábito, do mais frequente para o menos.
 *
 * São os chips do card: o que você registra sempre precisa estar a um toque, e
 * `ultima_qtd` é o número com que o stepper abre — quem faz 20 flexões toda
 * vez não deve ter que digitar 20 toda vez.
 */
export async function usadosRecentemente(
  db: Client,
  userId: number,
  desde: string,
  limite: number,
): Promise<UsoRecente[]> {
  const rs = await db.execute({
    sql: `SELECT c.exercise_id, e.nome, e.medida,
                 COUNT(*) AS vezes,
                 (SELECT COALESCE(u.reps, u.segundos) FROM calistenia_sets u
                  WHERE u.user_id = c.user_id AND u.exercise_id = c.exercise_id
                  ORDER BY u.data DESC, u.created_at DESC LIMIT 1) AS ultima_qtd
          FROM calistenia_sets c
          JOIN exercises e ON e.id = c.exercise_id
          WHERE c.user_id = ? AND c.data >= ?
          GROUP BY c.exercise_id
          ORDER BY vezes DESC, e.nome
          LIMIT ?`,
    args: [userId, desde, limite],
  });
  return rs.rows.map((r) => ({
    exercise_id: r.exercise_id as number,
    nome: r.nome as string,
    medida: medidaDaColuna(r.medida),
    ultima_qtd: Number(r.ultima_qtd ?? 0),
    vezes: Number(r.vezes),
  }));
}

export async function listarMetas(db: Client, userId: number): Promise<MetaCalistenia[]> {
  const rs = await db.execute({
    sql: `SELECT m.exercise_id, e.nome, e.medida, m.alvo_dia
          FROM calistenia_metas m
          JOIN exercises e ON e.id = m.exercise_id
          WHERE m.user_id = ?
          ORDER BY e.nome`,
    args: [userId],
  });
  return rs.rows.map((r) => ({
    exercise_id: r.exercise_id as number,
    nome: r.nome as string,
    medida: medidaDaColuna(r.medida),
    alvo_dia: r.alvo_dia as number,
  }));
}

export async function salvarMeta(
  db: Client,
  userId: number,
  exerciseId: number,
  alvoDia: number,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO calistenia_metas (user_id, exercise_id, alvo_dia)
          VALUES (?, ?, ?)
          ON CONFLICT (user_id, exercise_id) DO UPDATE SET alvo_dia = excluded.alvo_dia`,
    args: [userId, exerciseId, alvoDia],
  });
}

export async function apagarMeta(
  db: Client,
  userId: number,
  exerciseId: number,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM calistenia_metas WHERE user_id = ? AND exercise_id = ?",
    args: [userId, exerciseId],
  });
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/repositories/calistenia.test.ts`
Esperado: PASSA.

- [ ] **Passo 5: commit**

```bash
git add src/repositories/calistenia.ts src/repositories/calistenia.test.ts
git commit -m "feat(calistenia): repositório da série avulsa e das metas"
```

---

## Task 5: Hooks

**Arquivos:**
- Criar: `src/hooks/use-calistenia.ts`

**Interfaces:**
- Consome: tudo o que a Task 4 exporta.
- Produz: `useSeriesDoDia`, `useSeriesPorRange`, `useExerciciosDeCalistenia`,
  `useUsadosRecentemente`, `useMetasCalistenia`, `useRegistrarCalistenia`,
  `useApagarSerieCalistenia`, `useSalvarMetaCalistenia`,
  `useApagarMetaCalistenia`, e as constantes `CHIPS_NO_CARD` e
  `JANELA_DE_HABITO_DIAS`.

Sem teste próprio: são wrappers finos do TanStack Query, exercitados pelos
testes de componente das Tasks 6–8. É o padrão dos outros hooks do repo, que só
têm teste quando carregam regra própria.

- [ ] **Passo 1: implementar**

`src/hooks/use-calistenia.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  apagarMeta, apagarSerie, exerciciosDeCalistenia, listarMetas, registrarSerie,
  salvarMeta, seriesDoDia, seriesPorRange, usadosRecentemente,
  type RegistroCalistenia,
} from "../repositories/calistenia";

/** Quantos exercícios viram chip no card, e por quanto tempo para trás olhar. */
export const CHIPS_NO_CARD = 6;
export const JANELA_DE_HABITO_DIAS = 30;

export function useSeriesDoDia(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "dia", data],
    queryFn: () => seriesDoDia(db, userId, data),
  });
}

export function useSeriesPorRange(inicio: string, fim: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "range", inicio, fim],
    queryFn: () => seriesPorRange(db, userId, inicio, fim),
  });
}

export function useExerciciosDeCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "exercicios"],
    queryFn: () => exerciciosDeCalistenia(db, userId),
  });
}

export function useUsadosRecentemente(desde: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "usados", desde],
    queryFn: () => usadosRecentemente(db, userId, desde, CHIPS_NO_CARD),
  });
}

export function useMetasCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "metas"],
    queryFn: () => listarMetas(db, userId),
  });
}

/**
 * Registrar uma série muda o dia, os chips e o gasto energético da análise.
 *
 * `analise` entra na invalidação porque a caloria da calistenia é somada ao
 * gasto na leitura — sem isto, o balanço da `/analise` continuaria mostrando
 * o número de antes do registro.
 */
function useEscritaNaCalistenia<TVars, TDados>(fn: (v: TVars) => Promise<TDados>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calistenia"] });
      qc.invalidateQueries({ queryKey: ["analise"] });
    },
  });
}

export function useRegistrarCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaCalistenia((r: RegistroCalistenia) => registrarSerie(db, userId, r));
}

export function useApagarSerieCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaCalistenia((id: number) => apagarSerie(db, userId, id));
}

export function useSalvarMetaCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaCalistenia((v: { exerciseId: number; alvoDia: number }) =>
    salvarMeta(db, userId, v.exerciseId, v.alvoDia),
  );
}

export function useApagarMetaCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaCalistenia((exerciseId: number) => apagarMeta(db, userId, exerciseId));
}
```

- [ ] **Passo 2: conferir os tipos**

Run: `npx tsc -b`
Esperado: sem erro.

- [ ] **Passo 3: commit**

```bash
git add src/hooks/use-calistenia.ts
git commit -m "feat(calistenia): hooks de leitura e escrita"
```

---

## Task 6: Folha de registro

**Arquivos:**
- Criar: `src/components/calistenia/sheet-registrar.tsx`
- Criar: `src/components/calistenia/sheet-registrar.test.tsx`

**Interfaces:**
- Consome: `useExerciciosDeCalistenia`, `useRegistrarCalistenia` (Task 5);
  `ExercicioAutocomplete` de `src/components/treino/exercicio-autocomplete.tsx`.
- Produz: `<SheetRegistrarCalistenia aberto onFechar data exercicioInicial />`,
  o tipo `EscolhaDeExercicio` e a função `comoRelogio(segundos): string`.

- [ ] **Passo 1: escrever o teste que falha**

`src/components/calistenia/sheet-registrar.test.tsx`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { criarWrapper } from "../../../test/helpers/query-wrapper";
import { SheetRegistrarCalistenia } from "./sheet-registrar";
import { seriesDoDia } from "../../repositories/calistenia";

let db: Client;

async function exercicio(nome: string, medida: string | null = null): Promise<number> {
  const rs = await db.execute({
    sql: `INSERT INTO exercises (user_id, nome, source, equipamento, met, fracao_corporal, medida, created_at)
          VALUES (NULL, ?, 'catalogo', 'peso_corporal', 8, 0.64, ?, 't')`,
    args: [nome, medida],
  });
  return Number(rs.lastInsertRowid);
}

function montar(inicial: {
  exercise_id: number; nome: string; medida: "reps" | "segundos"; ultima_qtd: number;
} | null) {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <SheetRegistrarCalistenia
        aberto
        onFechar={() => {}}
        data="2026-08-28"
        exercicioInicial={inicial}
      />
    </Wrapper>,
  );
}

beforeEach(async () => { db = await createTestDb(); });

describe("SheetRegistrarCalistenia", () => {
  // O stepper abre na última quantidade porque quem faz 20 flexões toda vez
  // não deve ter que digitar 20 toda vez. Dois toques: abrir e confirmar.
  it("abre com a última quantidade e grava com um toque", async () => {
    const flexao = await exercicio("Flexão de braço");
    montar({ exercise_id: flexao, nome: "Flexão de braço", medida: "reps", ultima_qtd: 20 });

    expect(await screen.findByText("20")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      const series = await seriesDoDia(db, 1, "2026-08-28");
      expect(series).toHaveLength(1);
      expect(series[0].reps).toBe(20);
    });
  });

  it("o stepper soma e subtrai", async () => {
    const flexao = await exercicio("Flexão de braço");
    montar({ exercise_id: flexao, nome: "Flexão de braço", medida: "reps", ultima_qtd: 20 });

    await userEvent.click(await screen.findByRole("button", { name: /^mais$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect((await seriesDoDia(db, 1, "2026-08-28"))[0].reps).toBe(21);
    });
  });

  it("nunca desce abaixo de 1", async () => {
    const flexao = await exercicio("Flexão de braço");
    montar({ exercise_id: flexao, nome: "Flexão de braço", medida: "reps", ultima_qtd: 1 });

    await userEvent.click(await screen.findByRole("button", { name: /^menos$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect((await seriesDoDia(db, 1, "2026-08-28"))[0].reps).toBe(1);
    });
  });

  // Prancha se conta em segundos, e o passo de 1 em 1 seria absurdo nela.
  it("isometria grava em segundos e anda de 5 em 5", async () => {
    const prancha = await exercicio("Prancha", "segundos");
    montar({ exercise_id: prancha, nome: "Prancha", medida: "segundos", ultima_qtd: 60 });

    expect(await screen.findByText("1:00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^mais$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      const [s] = await seriesDoDia(db, 1, "2026-08-28");
      expect(s.segundos).toBe(65);
      expect(s.reps).toBeNull();
    });
  });

  it("sem exercício escolhido, escolher um pela busca abre o stepper", async () => {
    await exercicio("Agachamento livre sem peso");
    montar(null);

    await userEvent.type(await screen.findByRole("combobox"), "Agacha");
    await userEvent.click(await screen.findByRole("button", { name: /^agachamento livre sem peso/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect(await seriesDoDia(db, 1, "2026-08-28")).toHaveLength(1);
    });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/calistenia/sheet-registrar.test.tsx`
Esperado: FALHA — `./sheet-registrar` não existe.

- [ ] **Passo 3: implementar**

`src/components/calistenia/sheet-registrar.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { ExercicioAutocomplete } from "../treino/exercicio-autocomplete";
import { useExerciciosDeCalistenia, useRegistrarCalistenia } from "../../hooks/use-calistenia";
import type { Medida } from "../../domain/calistenia";
import type { Exercise } from "../../domain/types";

/** Reps andam de 1 em 1; segundos, de 5 em 5 — passo de 1 s numa prancha de
 *  dois minutos seria um contador que ninguém usa. */
const PASSO: Record<Medida, number> = { reps: 1, segundos: 5 };
const PADRAO: Record<Medida, number> = { reps: 10, segundos: 30 };

export interface EscolhaDeExercicio {
  exercise_id: number;
  nome: string;
  medida: Medida;
  /** Com quanto o stepper abre. */
  ultima_qtd: number;
}

/** 90 → "1:30". Segundo é a medida da isometria, e "90 segundos" se lê pior
 *  do que o relógio que a pessoa estava olhando. */
export function comoRelogio(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SheetRegistrarCalistenia({
  aberto,
  onFechar,
  data,
  exercicioInicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  data: string;
  exercicioInicial: EscolhaDeExercicio | null;
}) {
  const { data: catalogo = [] } = useExerciciosDeCalistenia();
  const registrar = useRegistrarCalistenia();

  const [escolha, setEscolha] = useState<EscolhaDeExercicio | null>(exercicioInicial);
  const [quantidade, setQuantidade] = useState(exercicioInicial?.ultima_qtd ?? 0);
  const [pesoExtra, setPesoExtra] = useState("");

  // A folha é reaberta com um exercício diferente a cada chip tocado.
  useEffect(() => {
    if (!aberto) return;
    setEscolha(exercicioInicial);
    setQuantidade(exercicioInicial?.ultima_qtd ?? 0);
    setPesoExtra("");
  }, [aberto, exercicioInicial]);

  const medida = escolha?.medida ?? "reps";
  const passo = PASSO[medida];

  function gravar() {
    if (!escolha || quantidade <= 0) return;
    const extra = Number(pesoExtra.replace(",", "."));
    registrar.mutate({
      data,
      exercise_id: escolha.exercise_id,
      reps: medida === "reps" ? quantidade : null,
      segundos: medida === "segundos" ? quantidade : null,
      peso_extra_kg: Number.isFinite(extra) && extra > 0 ? extra : null,
    });
    onFechar();
  }

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>{escolha ? escolha.nome : "Registrar série"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {!escolha ? (
            <div>
              <Label htmlFor="calistenia-exercicio">Exercício</Label>
              <ExercicioAutocomplete
                id="calistenia-exercicio"
                exercicios={catalogo as unknown as Exercise[]}
                selecionado={null}
                onSelecionar={(e) => {
                  const doCatalogo = catalogo.find((c) => c.id === e.id);
                  const m: Medida = doCatalogo?.medida ?? "reps";
                  setEscolha({
                    exercise_id: e.id, nome: e.nome, medida: m, ultima_qtd: PADRAO[m],
                  });
                  setQuantidade(PADRAO[m]);
                }}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.max(passo, q - passo))}
                  aria-label="Menos"
                  className="flex size-14 items-center justify-center rounded-full border border-input transition-colors hover:bg-muted"
                >
                  <Minus className="size-6" />
                </button>
                <span className="min-w-[4ch] text-center">
                  <span className="block text-5xl font-bold tabular-nums">
                    {medida === "segundos" ? comoRelogio(quantidade) : quantidade}
                  </span>
                  <span className="t-caption block">
                    {medida === "segundos" ? "segundos" : "repetições"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => q + passo)}
                  aria-label="Mais"
                  className="flex size-14 items-center justify-center rounded-full border border-input transition-colors hover:bg-muted"
                >
                  <Plus className="size-6" />
                </button>
              </div>

              <div>
                <Label htmlFor="calistenia-extra">Peso extra (kg, opcional)</Label>
                <Input
                  id="calistenia-extra"
                  inputMode="decimal"
                  value={pesoExtra}
                  onChange={(e) => setPesoExtra(e.target.value)}
                  placeholder="Colete, anilha…"
                />
              </div>

              <Button block size="lg" onClick={gravar} disabled={registrar.isPending}>
                Registrar
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Nota para quem executa:** `ExercicioAutocomplete` espera `Exercise[]`, e
`ExercicioDeCalistenia` traz só o que a busca usa (`id`, `nome`, `aliases`,
`grupo_nome`, `source`). Se o `tsc -b` reclamar do cast, a saída limpa é
`exerciciosDeCalistenia` devolver `Exercise[]` completo, reusando o mapeamento
de `repositories/exercises.ts`, e a `medida` sair de `Exercise.medida` (que a
Task 2 já acrescentou). Prefira essa — é menos código e mais honesta.

- [ ] **Passo 4: rodar e ver passar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/calistenia/sheet-registrar.test.tsx`
Esperado: PASSA.

- [ ] **Passo 5: commit**

```bash
git add src/components/calistenia/
git commit -m "feat(calistenia): folha de registro com stepper de reps e de segundos"
```

---

## Task 7: Card de hoje

**Arquivos:**
- Criar: `src/components/calistenia/card-hoje.tsx`
- Criar: `src/components/calistenia/card-hoje.test.tsx`
- Modificar: `src/pages/dashboard.tsx`
- Modificar: `src/pages/treino.tsx`

**Interfaces:**
- Consome: `useSeriesDoDia`, `useUsadosRecentemente`, `useMetasCalistenia`,
  `JANELA_DE_HABITO_DIAS` (Task 5); `totaisPorExercicio` (Task 3);
  `SheetRegistrarCalistenia`, `comoRelogio`, `EscolhaDeExercicio` (Task 6);
  `useProfile` para o peso corporal.
- Produz: `<CardCalisteniaHoje data={string} />`.

- [ ] **Passo 1: escrever o teste que falha**

`src/components/calistenia/card-hoje.test.tsx`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../../test/helpers/test-db";
import { criarWrapper } from "../../../test/helpers/query-wrapper";
import { CardCalisteniaHoje } from "./card-hoje";
import { registrarSerie, salvarMeta, seriesDoDia } from "../../repositories/calistenia";

const DATA = "2026-08-28";
let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: `INSERT INTO exercises (user_id, nome, source, equipamento, met, fracao_corporal, created_at)
          VALUES (NULL, ?, 'catalogo', 'peso_corporal', 8, 0.64, 't')`,
    args: [nome],
  });
  return Number(rs.lastInsertRowid);
}

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <CardCalisteniaHoje data={DATA} />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => { db = await createTestDb(); });

describe("CardCalisteniaHoje", () => {
  it("soma as séries do dia por exercício", async () => {
    const flexao = await exercicio("Flexão de braço");
    for (const reps of [20, 20]) {
      await registrarSerie(db, 1, {
        data: DATA, exercise_id: flexao, reps, segundos: null, peso_extra_kg: null,
      });
    }
    montar();

    expect(await screen.findByText("Flexão de braço")).toBeInTheDocument();
    expect(await screen.findByText("40")).toBeInTheDocument();
  });

  it("com meta, mostra o quanto falta", async () => {
    const flexao = await exercicio("Flexão de braço");
    await salvarMeta(db, 1, flexao, 100);
    await registrarSerie(db, 1, {
      data: DATA, exercise_id: flexao, reps: 40, segundos: null, peso_extra_kg: null,
    });
    montar();

    expect(await screen.findByText("40 / 100")).toBeInTheDocument();
  });

  // O chip é o caminho de dois toques: um abre a folha já no exercício certo,
  // o outro confirma.
  it("o chip de um exercício usado abre a folha e grava", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: DATA, exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /registrar flexão de braço/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^registrar$/i }));

    await waitFor(async () => {
      expect(await seriesDoDia(db, 1, DATA)).toHaveLength(2);
    });
  });

  it("sem histórico nenhum, explica o que o card é", async () => {
    montar();
    expect(await screen.findByText(/flexões e agachamentos soltos/i)).toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/calistenia/card-hoje.test.tsx`
Esperado: FALHA — `./card-hoje` não existe.

- [ ] **Passo 3: implementar**

`src/components/calistenia/card-hoje.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/empty-state";
import { Progress } from "../ui/progress";
import { useProfile } from "../../hooks/use-profile";
import {
  JANELA_DE_HABITO_DIAS, useMetasCalistenia, useSeriesDoDia, useUsadosRecentemente,
} from "../../hooks/use-calistenia";
import { totaisPorExercicio } from "../../domain/calistenia";
import { comoRelogio, SheetRegistrarCalistenia, type EscolhaDeExercicio } from "./sheet-registrar";

/** A data de N dias atrás, em "YYYY-MM-DD". */
function diasAtras(data: string, n: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A calistenia do dia, com o registro a dois toques.
 *
 * O mesmo componente no Dashboard e na aba "Hoje" do treino: duas telas
 * contando histórias diferentes sobre o mesmo estado é o defeito que o achado
 * B9 registrou no card de treino, e não vale a pena repeti-lo aqui.
 */
export function CardCalisteniaHoje({ data }: { data: string }) {
  const { data: perfil } = useProfile();
  const { data: series = [], isPending } = useSeriesDoDia(data);
  const { data: chips = [] } = useUsadosRecentemente(diasAtras(data, JANELA_DE_HABITO_DIAS));
  const { data: metas = [] } = useMetasCalistenia();
  // `undefined` = folha fechada; `null` = aberta sem exercício escolhido.
  const [registrando, setRegistrando] = useState<EscolhaDeExercicio | null | undefined>(undefined);

  const totais = totaisPorExercicio(series, perfil?.peso_kg ?? 0);

  if (isPending) return null;

  const vazio = totais.length === 0 && chips.length === 0;

  return (
    <>
      <Card
        header="Calistenia hoje"
        aside={
          <Link to="/treino/calistenia" className="text-[0.8125rem] font-medium text-primary">
            Ver tudo
          </Link>
        }
      >
        {vazio ? (
          <EmptyState
            title="Nada registrado ainda"
            description="As flexões e agachamentos soltos que você faz ao longo do dia entram aqui — e passam a contar no seu gasto de calorias."
            action={
              <button
                type="button"
                onClick={() => setRegistrando(null)}
                className="flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary"
              >
                <Plus className="size-4" /> Registrar série
              </button>
            }
          />
        ) : (
          <>
            {totais.length > 0 && (
              <ul className="space-y-2">
                {totais.map((t) => {
                  const meta = metas.find((m) => m.exercise_id === t.exercise_id);
                  const rotulo =
                    t.medida === "segundos" ? comoRelogio(t.quantidade) : String(t.quantidade);
                  return (
                    <li key={t.exercise_id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">{t.nome}</span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {meta ? `${rotulo} / ${meta.alvo_dia}` : rotulo}
                        </span>
                      </div>
                      {meta && (
                        <Progress value={t.quantidade} max={meta.alvo_dia} className="mt-1" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c.exercise_id}
                  type="button"
                  aria-label={`Registrar ${c.nome}`}
                  onClick={() =>
                    setRegistrando({
                      exercise_id: c.exercise_id,
                      nome: c.nome,
                      medida: c.medida,
                      ultima_qtd: c.ultima_qtd,
                    })
                  }
                  className="flex min-h-11 items-center gap-1 rounded-full bg-muted px-3 text-[0.8125rem] font-medium transition-colors hover:bg-muted/70"
                >
                  <Plus className="size-3.5" />
                  <span className="max-w-[9rem] truncate">{c.nome}</span>
                </button>
              ))}
              <button
                type="button"
                aria-label="Registrar outro exercício"
                onClick={() => setRegistrando(null)}
                className="flex min-h-11 items-center rounded-full border border-dashed border-border px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </>
        )}
      </Card>

      <SheetRegistrarCalistenia
        aberto={registrando !== undefined}
        onFechar={() => setRegistrando(undefined)}
        data={data}
        exercicioInicial={registrando ?? null}
      />
    </>
  );
}
```

**Nota:** conferir a assinatura real de `Progress` em
`src/components/ui/progress.tsx` antes de usar — se os props tiverem outros
nomes, ajustar. Nenhum teste depende dela.

- [ ] **Passo 4: rodar e ver passar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/calistenia/card-hoje.test.tsx`
Esperado: PASSA.

- [ ] **Passo 5: montar o card nas duas telas**

Em `src/pages/dashboard.tsx`, importar `CardCalisteniaHoje` e montá-lo logo
depois do card de treino:

```tsx
<CardCalisteniaHoje data={data} />
```

Em `src/pages/treino.tsx`, montá-lo depois do card de hoje e antes de
"Últimas sessões" (a variável da data já se chama `data` ali):

```tsx
<CardCalisteniaHoje data={data} />
```

- [ ] **Passo 6: rodar a suíte inteira**

Run: `npm test`
Esperado: tudo verde — em especial `src/pages/dashboard.test.tsx` e
`src/pages/treino.test.tsx`, que agora renderizam o card novo.

- [ ] **Passo 7: commit**

```bash
git add src/components/calistenia/ src/pages/dashboard.tsx src/pages/treino.tsx
git commit -m "feat(calistenia): card do dia no dashboard e na aba Hoje"
```

---

## Task 8: Página `/treino/calistenia`

**Arquivos:**
- Criar: `src/pages/treino-calistenia.tsx`
- Criar: `src/pages/treino-calistenia.test.tsx`
- Modificar: `src/App.tsx` (rota)
- Modificar: `src/pages/treino-layout.tsx` (`alias` da aba Hoje)
- Modificar: `src/components/ui/tabs-nav.tsx` (só se o passo 4 exigir)

**Interfaces:**
- Consome: todos os hooks da Task 5, o domínio da Task 3,
  `SheetRegistrarCalistenia` e `comoRelogio` da Task 6, `LineChart` de
  `src/components/line-chart.tsx`, `Segmented` de
  `src/components/ui/segmented.tsx`, `Stat` de `src/components/ui/stat.tsx`.
- Produz: a rota `/treino/calistenia`.

- [ ] **Passo 1: escrever o teste que falha**

`src/pages/treino-calistenia.test.tsx`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { TreinoCalistenia } from "./treino-calistenia";
import { listarMetas, registrarSerie, seriesDoDia } from "../repositories/calistenia";
import { hoje } from "../lib/date";

let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: `INSERT INTO exercises (user_id, nome, source, equipamento, met, fracao_corporal, created_at)
          VALUES (NULL, ?, 'catalogo', 'peso_corporal', 8, 0.64, 't')`,
    args: [nome],
  });
  return Number(rs.lastInsertRowid);
}

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <TreinoCalistenia />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => { db = await createTestDb(); });

describe("TreinoCalistenia", () => {
  it("lista as séries de hoje com a quantidade de cada uma", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: hoje(), exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    expect(await screen.findByText("Flexão de braço")).toBeInTheDocument();
    expect(await screen.findByText(/20 reps/i)).toBeInTheDocument();
  });

  it("apaga uma série do dia", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: hoje(), exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /excluir série/i }));

    await waitFor(async () => {
      expect(await seriesDoDia(db, 1, hoje())).toHaveLength(0);
    });
  });

  it("a visão da semana traz o total e o recorde de série", async () => {
    const flexao = await exercicio("Flexão de braço");
    for (const reps of [20, 35]) {
      await registrarSerie(db, 1, {
        data: hoje(), exercise_id: flexao, reps, segundos: null, peso_extra_kg: null,
      });
    }
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /^semana$/i }));

    expect(await screen.findByText("55")).toBeInTheDocument();
    expect(await screen.findByText(/recorde/i)).toBeInTheDocument();
  });

  it("cria uma meta diária", async () => {
    const flexao = await exercicio("Flexão de braço");
    await registrarSerie(db, 1, {
      data: hoje(), exercise_id: flexao, reps: 20, segundos: null, peso_extra_kg: null,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /^metas$/i }));
    await userEvent.type(await screen.findByLabelText(/meta diária de flexão de braço/i), "100");
    await userEvent.click(await screen.findByRole("button", { name: /salvar meta de flexão/i }));

    await waitFor(async () => {
      const metas = await listarMetas(db, 1);
      expect(metas[0].alvo_dia).toBe(100);
    });
  });

  it("sem registro nenhum, mostra o estado vazio", async () => {
    montar();
    expect(await screen.findByText(/nenhuma série registrada/i)).toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/pages/treino-calistenia.test.tsx`
Esperado: FALHA — `./treino-calistenia` não existe.

- [ ] **Passo 3: implementar a página**

`src/pages/treino-calistenia.tsx` — três visões num `Segmented`, no padrão de
`/treino/progresso` (`const VISOES = [{ valor, label }]` + `useState<Visao>`):

- **Hoje** — `useSeriesDoDia(hoje())`. Um botão "Registrar série" no topo que
  abre `SheetRegistrarCalistenia` sem exercício. Uma linha por série com a hora
  (`new Date(s.created_at)` formatado `HH:MM`), a quantidade
  (`${s.reps} reps` ou `comoRelogio(s.segundos)`) e um botão
  `aria-label={\`Excluir série de ${s.nome}\`}` chamando
  `useApagarSerieCalistenia`. Lista vazia → `EmptyState` com o título
  **"Nenhuma série registrada"**.
- **Semana** — `useSeriesPorRange(diasAtras(hoje(), 6), hoje())`. Um `Stat` de
  sequência (`sequenciaDeDias(series.map((s) => s.data), hoje())`), um
  `LineChart` de reps por dia (de `totaisPorDia`), e uma lista de
  `totaisPorExercicio` mostrando `quantidade`, `recorde` com o rótulo
  **"recorde"**, volume e kcal. A tendência sai de
  `tendencia(quantidadeDestaSemana, quantidadeDasQuatroAnteriores / 4)` —
  buscar também `useSeriesPorRange(diasAtras(hoje(), 34), diasAtras(hoje(), 7))`
  para a base. `null` → não renderizar a linha de tendência.
- **Metas** — para cada exercício com registro nos últimos 30 dias
  (`useUsadosRecentemente`), um `Input` numérico com
  `aria-label={\`Meta diária de ${nome}\`}` e um botão
  `aria-label={\`Salvar meta de ${nome}\`}` (`useSalvarMetaCalistenia`). Onde já
  houver meta, um botão `Remover meta de ${nome}` (`useApagarMetaCalistenia`).

Cabeçalho no padrão de `treino-sessao-detalhe.tsx`: `<BackLink to="/treino">Treino</BackLink>`
e um `<h2 className="t-title">Calistenia</h2>` — a tela vive dentro do
`TreinoLayout`, que já desenha o `PageHeader` com as abas.

Reusar o helper `diasAtras` da Task 7 — extraí-lo de `card-hoje.tsx` para
`src/lib/date.ts` (com teste em `src/lib/date.test.ts`) em vez de duplicá-lo.

- [ ] **Passo 4: registrar a rota**

Em `src/App.tsx`, dentro do bloco `<Route path="/treino" element={<TreinoLayout />}>`:

```tsx
<Route path="calistenia" element={<TreinoCalistenia />} />
```

Em `src/pages/treino-layout.tsx`, a aba "Hoje" passa a acender também na
calistenia — a tela nasceu do card que vive lá:

```tsx
  { to: "/treino", label: "Hoje", fim: true, alias: ["/treino/calistenia"] },
```

**Atenção:** em `src/components/ui/tabs-nav.tsx`, `fim: true` faz o cálculo de
`ativo` casar só `pathname === a.to` e ignorar `alias`. Ajustar para considerar
`alias` mesmo com `fim`:

```tsx
const casaAlias = a.alias?.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ?? false;
const ativo = a.fim
  ? pathname === a.to || casaAlias
  : pathname === a.to || pathname.startsWith(`${a.to}/`) || casaAlias;
```

- [ ] **Passo 5: teste da navegação**

Em `src/pages/treino-layout.test.tsx`, acrescentar — seguindo o padrão dos
testes já existentes no arquivo para montar o layout numa rota:

```ts
// A calistenia nasceu do card que vive em "Hoje"; sem o alias, abrir a tela
// apagava as quatro abas e a tela dizia "você não está em lugar nenhum".
it("a aba Hoje acende na calistenia", async () => {
  montarEm("/treino/calistenia");
  expect(await screen.findByRole("link", { name: "Hoje" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
```

- [ ] **Passo 6: rodar e ver passar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/pages/treino-calistenia.test.tsx src/pages/treino-layout.test.tsx src/lib/date.test.ts`
Esperado: PASSA.

- [ ] **Passo 7: commit**

```bash
git add src/pages/treino-calistenia.tsx src/pages/treino-calistenia.test.tsx src/App.tsx src/pages/treino-layout.tsx src/pages/treino-layout.test.tsx src/components/ui/tabs-nav.tsx src/lib/date.ts src/lib/date.test.ts src/components/calistenia/card-hoje.tsx
git commit -m "feat(calistenia): a tela com hoje, semana e metas"
```

---

## Task 9: A caloria entra no balanço energético

**Arquivos:**
- Modificar: `src/pages/analise.tsx`
- Modificar: `src/pages/analise.test.tsx`
- Modificar: `README.md`

**Interfaces:**
- Consome: `useSeriesPorRange` (Task 5), `kcalPorDia` e `totaisPorDia` (Task 3).
- Produz: nada que outra tarefa use — é a ponta final.

- [ ] **Passo 1: escrever o teste que falha**

Em `src/pages/analise.test.tsx`, seguindo o teste de cardio que já existe no
arquivo (montagem, `upsertProfile`, ida à aba "Atividade"):

```ts
// É o ponto onde o módulo responde à pergunta que o motivou: as flexões
// soltas do dia contam no gasto, do mesmo jeito que a bicicleta.
it("a caloria da calistenia entra no gasto do período", async () => {
  const flexao = await exercicioDePesoCorporal("Flexão de braço"); // met 8, fracao 0.64
  await upsertProfile(db, 1, { /* ...os campos que o teste de cardio já usa... */ peso_kg: 80 });
  await registrarSerie(db, 1, {
    data: hoje(), exercise_id: flexao, reps: 60, segundos: null, peso_extra_kg: null,
  });

  montar();
  await userEvent.click(await screen.findByRole("button", { name: /atividade/i }));

  // 60 reps × 3 s = 180 s. 8 MET × 80 kg × 0,05 h = 32 kcal.
  expect(await screen.findByText(/32/)).toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/pages/analise.test.tsx`
Esperado: FALHA — o gasto não inclui a calistenia.

- [ ] **Passo 3: somar na tela**

Em `src/pages/analise.tsx`:

```tsx
const { data: calistenia = [] } = useSeriesPorRange(periodo.inicio, periodo.fim);

const pesoCorporal = profile?.peso_kg ?? 0;

/* O gasto do dia é o cardio MAIS a calistenia. Ela não grava em
   `activity_sessions` de propósito (ver spec 2026-08-28, decisão D5): vinte
   séries de trinta segundos dariam vinte atividades por dia, e apagar uma
   série deixaria caloria órfã contando um esforço que não houve. */
const gastoPorDia = new Map(kcalGastaPorDia(sessions));
for (const [dia, kcal] of kcalPorDia(calistenia, pesoCorporal)) {
  gastoPorDia.set(dia, (gastoPorDia.get(dia) ?? 0) + kcal);
}
```

Trocar o uso de `kcalGastaPorDia(sessions)` por `gastoPorDia` na chamada a
`balancoEnergetico` e em tudo o mais que consuma o gasto.

Na aba Atividade, um `Stat` próprio ao lado do de cardio — conferir a
assinatura real de `Stat` em `src/components/ui/stat.tsx` antes de escrever:

```tsx
{totalDaCalistenia.nSeries > 0 && (
  <Stat
    label="Calistenia"
    value={String(totalDaCalistenia.reps)}
    hint={`${Math.round(totalDaCalistenia.kcal)} kcal`}
  />
)}
```

onde `totalDaCalistenia` soma os valores de `totaisPorDia(calistenia, pesoCorporal)`.

- [ ] **Passo 4: rodar e ver passar**

Run: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/pages/analise.test.tsx`
Esperado: PASSA.

- [ ] **Passo 5: suíte inteira e tipos**

Run: `npm test && npx tsc -b`
Esperado: tudo verde, sem erro de tipo.

- [ ] **Passo 6: atualizar o README**

Na seção "Funcionalidades", entre "Treino" e "Ficha de exercício":

```markdown
**Calistenia**
- 🤸 As séries soltas do dia — flexão, agachamento, prancha — em dois toques
- 🎯 Meta diária opcional por exercício
- 📊 Volume equivalente pela fração do peso corporal, recorde de série e a
      tendência contra as quatro semanas anteriores
- 🔥 A caloria estimada entra no balanço energético, ao lado do cardio
```

E na tabela de pastas da seção "Arquitetura":

```markdown
| `src/domain/calistenia.ts` | A série que acontece fora da sessão: volume por fração do peso corporal, caloria por MET, recorde e sequência de dias. Puro. |
```

- [ ] **Passo 7: commit**

```bash
git add src/pages/analise.tsx src/pages/analise.test.tsx README.md
git commit -m "feat(calistenia): a caloria da série avulsa entra no balanço energético"
```

---

## Critérios de aceite (da spec)

Conferir um a um na aplicação rodando (`npm run dev`), depois da Task 9:

1. Registrar 20 flexões a partir do Dashboard custa dois toques, e o card
   mostra o total do dia imediatamente.
2. Prancha é registrada em segundos e exibida como `mm:ss` em toda tela.
3. Um dia só de calistenia **não** aparece em "treinos por semana" da
   consistência da rotina.
4. A kcal estimada da calistenia aparece no gasto e no balanço energético da
   `/analise`, no mesmo período.
5. Uma meta diária de 100 flexões mostra progresso no card e some do card
   quando removida.
6. Excluir uma série corrige todos os números do dia, sem deixar caloria órfã.
7. `npm test` passa inteiro; `npm run build` compila sem erro de tipo.
