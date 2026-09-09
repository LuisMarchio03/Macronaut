# Troca com mais de um alimento — plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Os passos usam checkbox (`- [ ]`).

**Objetivo:** deixar uma linha do plano ser trocada por N alimentos, deixar
dispensar a linha que não foi comida, e fazer o card da refeição mostrar a
caloria realizada contra a meta.

**Arquitetura:** `plan_item_swaps` perde o `UNIQUE (user_id, data, item_id)` e
ganha `dispensado`; a mudança exige RECONSTRUIR a tabela (SQLite não remove
constraint). O domínio troca o singular pelo plural (`trocaDoItem` →
`trocasDoItem`), ganha `itemDispensado` e `kcalDaRefeicao`, e as telas
empilham as N escolhas.

**Stack:** React 19 + TypeScript, TanStack Query, Tailwind 4, libSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-troca-multipla-design.md`

## Restrições globais

- Português em nomes, comentários, commits e interface. Comentário explica
  **por quê**, nunca o quê.
- Repositório recebe `(db, userId, …)` e filtra por `user_id` em toda consulta.
- Nada de SQL no cliente: função nova só existe depois de entrar em
  `api/_lib/registro.ts` — os testes de componente passam pelo mesmo registro.
- Testes: `npm test`; um arquivo:
  `NODE_OPTIONS=--no-experimental-webstorage npx vitest run <caminho>`.
  **A flag não é opcional** — sem ela `localStorage` é `undefined` e testes
  corretos falham. Tipos: `npm run build`.
- Commit por tarefa.

---

## Estrutura de arquivos

**Modificar**

| Arquivo | Mudança |
| --- | --- |
| `src/db/schema.sql` | `plan_item_swaps` no formato novo. |
| `scripts/lib/apply-schema.ts` | `REBUILDS` + `aplicarReconstrucoes`. |
| `scripts/lib/apply-schema.test.ts` | a reconstrução preserva as linhas. |
| `src/domain/plano-types.ts` | `TrocaDeItem.dispensado`. |
| `src/domain/plano-dia.ts` | `trocasDoItem`, `itemDispensado`, `kcalDaRefeicao`, `itensResolvidos`. |
| `src/repositories/plano.ts` | `adicionarTroca`, `removerUmaTroca`, `dispensarItem`, `mapTroca`, ordem. |
| `api/_lib/registro.ts` | as três operações novas. |
| `src/hooks/use-plano.ts` | `useSalvarTroca` → as escritas novas. |
| `src/components/plano/sheet-trocas.tsx` | lista de escolhidos, "Adicionar", dispensar, "Próximo item". |
| `src/components/plano/bloco-card.tsx` | kcal realizada; N trocas por linha. |
| `src/pages/dashboard.tsx` | liga as escritas novas. |

---

## Task 1: A tabela reconstruída

**Arquivos**
- Modificar: `src/db/schema.sql` (`plan_item_swaps`, ~linha 337)
- Modificar: `scripts/lib/apply-schema.ts`
- Teste: `scripts/lib/apply-schema.test.ts`

**Interfaces**
- Produz: `plan_item_swaps` sem `UNIQUE (user_id, data, item_id)`, com
  `dispensado INTEGER NOT NULL DEFAULT 0`, o `CHECK` de duas formas e o índice
  único parcial da dispensa. `applyAdditiveColumns` continua sendo o ponto de
  entrada único do `db:setup`.

- [ ] **Passo 1: o teste que falha**

```ts
/** A tabela no formato ANTIGO — com UNIQUE e o CHECK de uma origem só. */
async function bancoComTrocasAntigas() {
  const db = createClient({ url: ":memory:" });
  await db.execute(`CREATE TABLE plan_item_swaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, data TEXT NOT NULL,
    block_id INTEGER NOT NULL, item_id INTEGER NOT NULL,
    swap_id INTEGER, food_id INTEGER, texto TEXT,
    qty_g REAL, measure_id INTEGER, medidas REAL, kcal REAL,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, data, item_id),
    CHECK ((swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
  )`);
  await db.execute(`INSERT INTO plan_item_swaps
    (user_id, data, block_id, item_id, food_id, qty_g, kcal, created_at)
    VALUES (1, '2026-08-31', 10, 5, 42, 100, 128, '2026-08-31T10:00:00.000Z')`);
  return db;
}

describe("applyAdditiveColumns — plan_item_swaps reconstruída", () => {
  it("preserva as trocas já gravadas, com dispensado = 0", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    const rs = await db.execute("SELECT * FROM plan_item_swaps");
    expect(rs.rows).toHaveLength(1);
    expect(rs.rows[0].food_id).toBe(42);
    expect(rs.rows[0].kcal).toBe(128);
    expect(rs.rows[0].dispensado).toBe(0);
  });

  it("passa a aceitar duas trocas no mesmo item", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    await db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, food_id, qty_g, kcal, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, 5, 77, 50, 90, 't', 0)`);

    const rs = await db.execute("SELECT COUNT(*) AS n FROM plan_item_swaps WHERE item_id=5");
    expect(Number(rs.rows[0].n)).toBe(2);
  });

  it("aceita a dispensa, e só uma por item", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    await db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, 9, 't', 1)`);

    await expect(db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, 9, 't', 1)`)).rejects.toThrow();
  });

  it("rodar de novo não mexe em nada", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);
    await applyAdditiveColumns(db);
    const rs = await db.execute("SELECT COUNT(*) AS n FROM plan_item_swaps");
    expect(Number(rs.rows[0].n)).toBe(1);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run scripts/lib/apply-schema.test.ts`
Esperado: FAIL — não existe coluna `dispensado`.

- [ ] **Passo 3: o formato novo em `schema.sql`**

Substituir o bloco `plan_item_swaps` inteiro:

```sql
-- Uma linha por ALIMENTO escolhido: a mesma linha do plano pode receber
-- vários. Era UNIQUE (user_id, data, item_id) — uma troca por linha, e
-- trocar de novo corrigia a anterior. É o desenho certo para "errei, quis
-- dizer outra coisa" e o errado para "comi duas coisas no lugar dessa".
CREATE TABLE IF NOT EXISTS plan_item_swaps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  data       TEXT    NOT NULL,             -- 'YYYY-MM-DD'
  block_id   INTEGER NOT NULL,
  item_id    INTEGER NOT NULL,             -- plan_items.id: QUAL linha
  swap_id    INTEGER,                      -- plan_swaps.id  → prevista no plano
  food_id    INTEGER,                      -- foods.id       → alimento do catálogo
  texto      TEXT,                         -- o que você escreveu
  qty_g      REAL,
  measure_id INTEGER,
  medidas    REAL,
  -- NULL = kcal desconhecida, e a tela DIZ isso em vez de contar zero.
  kcal       REAL,
  -- Você não comeu esta linha, e não comeu outra coisa no lugar. É a terceira
  -- resposta possível, e sem ela trocar a refeição inteira por dois alimentos
  -- exigia inventar uma troca para cada linha restante.
  dispensado INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  CHECK (
    (dispensado = 1 AND swap_id IS NULL AND food_id IS NULL AND texto IS NULL)
    OR
    (dispensado = 0
     AND (swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
  ),
  FOREIGN KEY (block_id)   REFERENCES plan_blocks (id)   ON DELETE CASCADE,
  FOREIGN KEY (item_id)    REFERENCES plan_items (id)    ON DELETE CASCADE,
  FOREIGN KEY (swap_id)    REFERENCES plan_swaps (id)    ON DELETE SET NULL,
  FOREIGN KEY (food_id)    REFERENCES foods (id)         ON DELETE SET NULL,
  FOREIGN KEY (measure_id) REFERENCES food_measures (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_item_swaps_dia ON plan_item_swaps (user_id, data);
-- No máximo uma dispensa por linha por dia. A exclusão mútua entre dispensa e
-- troca é do repositório: um CHECK não enxerga outras linhas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_item_swaps_dispensa
  ON plan_item_swaps (user_id, data, item_id) WHERE dispensado = 1;
```

- [ ] **Passo 4: o mecanismo de reconstrução**

Em `scripts/lib/apply-schema.ts`, depois de `ADDITIVE_INDEXES`:

```ts
/**
 * Mudanças de tabela que `ALTER TABLE` não faz.
 *
 * SQLite não remove `UNIQUE` nem altera `CHECK`: a tabela tem que ser
 * recriada e os dados copiados. É o passo mais perigoso de uma migração —
 * ele apaga uma tabela — então cada entrada diz como RECONHECER o formato
 * antigo lendo o DDL guardado em `sqlite_master`. Reconhecido, reconstrói;
 * não reconhecido, não faz nada. É isso que torna o passo idempotente e
 * seguro de rodar a cada `db:setup`.
 */
const REBUILDS: { table: string; obsoleto: RegExp; passos: string[] }[] = [
  {
    table: "plan_item_swaps",
    // O formato antigo é exatamente o que tinha esta UNIQUE.
    obsoleto: /UNIQUE\s*\(\s*user_id\s*,\s*data\s*,\s*item_id\s*\)/i,
    passos: [
      `CREATE TABLE plan_item_swaps_nova (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL, data TEXT NOT NULL,
         block_id INTEGER NOT NULL, item_id INTEGER NOT NULL,
         swap_id INTEGER, food_id INTEGER, texto TEXT,
         qty_g REAL, measure_id INTEGER, medidas REAL, kcal REAL,
         dispensado INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL,
         CHECK (
           (dispensado = 1 AND swap_id IS NULL AND food_id IS NULL AND texto IS NULL)
           OR
           (dispensado = 0
            AND (swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
         ),
         FOREIGN KEY (block_id)   REFERENCES plan_blocks (id)   ON DELETE CASCADE,
         FOREIGN KEY (item_id)    REFERENCES plan_items (id)    ON DELETE CASCADE,
         FOREIGN KEY (swap_id)    REFERENCES plan_swaps (id)    ON DELETE SET NULL,
         FOREIGN KEY (food_id)    REFERENCES foods (id)         ON DELETE SET NULL,
         FOREIGN KEY (measure_id) REFERENCES food_measures (id) ON DELETE SET NULL
       )`,
      // Toda troca já gravada continua sendo uma troca: dispensado = 0.
      `INSERT INTO plan_item_swaps_nova
         (id, user_id, data, block_id, item_id, swap_id, food_id, texto,
          qty_g, measure_id, medidas, kcal, dispensado, created_at)
       SELECT id, user_id, data, block_id, item_id, swap_id, food_id, texto,
              qty_g, measure_id, medidas, kcal, 0, created_at
         FROM plan_item_swaps`,
      `DROP TABLE plan_item_swaps`,
      `ALTER TABLE plan_item_swaps_nova RENAME TO plan_item_swaps`,
      `CREATE INDEX IF NOT EXISTS idx_plan_item_swaps_dia
         ON plan_item_swaps (user_id, data)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_item_swaps_dispensa
         ON plan_item_swaps (user_id, data, item_id) WHERE dispensado = 1`,
    ],
  },
];

/** O DDL com que a tabela foi criada, como o SQLite o guardou. */
async function ddlDaTabela(db: Client, table: string): Promise<string | null> {
  const rs = await db.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
    args: [table],
  });
  return rs.rows.length ? ((rs.rows[0].sql as string | null) ?? null) : null;
}

async function aplicarReconstrucoes(db: Client): Promise<void> {
  for (const r of REBUILDS) {
    const ddl = await ddlDaTabela(db, r.table);
    if (ddl === null || !r.obsoleto.test(ddl)) continue;
    // `migrate`, não `batch`: é o modo do libSQL para DDL transacional — ele
    // suspende a checagem de chave estrangeira durante a troca. Com as FKs
    // ativas, o DROP no meio do lote falha ou deixa a tabela pela metade.
    await db.migrate(r.passos);
  }
}
```

E, em `applyAdditiveColumns`, **antes** do laço de colunas — uma tabela
reconstruída já nasce no formato final, e as colunas aditivas seguintes
precisam vê-la assim:

```ts
export async function applyAdditiveColumns(db: Client): Promise<void> {
  await aplicarReconstrucoes(db);
  for (const m of ADDITIVE_COLUMNS) {
```

- [ ] **Passo 5: rodar e commitar**

`npx vitest run scripts/lib/apply-schema.test.ts`, depois `npm test`.

```bash
git add src/db/schema.sql scripts/lib/apply-schema.ts scripts/lib/apply-schema.test.ts
git commit -m "feat(plano): a linha do plano passa a caber mais de um alimento"
```

---

## Task 2: O domínio

**Arquivos**
- Modificar: `src/domain/plano-types.ts` (`TrocaDeItem`)
- Modificar: `src/domain/plano-dia.ts` (`trocaDoItem` ~162, `itensResolvidos` ~191)
- Teste: `src/domain/plano-dia.test.ts`

**Interfaces**
- Consome: Task 1.
- Produz: `TrocaDeItem.dispensado: boolean`;
  `trocasDoItem(trocas, itemId): TrocaDeItem[]`;
  `itemDispensado(trocas, itemId): boolean`;
  `kcalDaRefeicao(itens, trocas): { total: number; incompleto: boolean }`;
  `itensResolvidos(itens, trocas): { lancaveis; semAlimento; dispensados }`.

- [ ] **Passo 1: os testes que falham**

```ts
describe("trocasDoItem e itemDispensado", () => {
  it("devolve todas as trocas da linha, na ordem de escolha", () => {
    const t = [
      troca({ id: 1, item_id: 5, nome: "Pão" }),
      troca({ id: 2, item_id: 5, nome: "Suco" }),
      troca({ id: 3, item_id: 6, nome: "Café" }),
    ];
    expect(trocasDoItem(t, 5).map((x) => x.nome)).toEqual(["Pão", "Suco"]);
  });

  it("linha intacta tem lista vazia", () => {
    expect(trocasDoItem([], 5)).toEqual([]);
  });

  it("a dispensa não conta como troca", () => {
    const t = [troca({ id: 1, item_id: 5, dispensado: true, nome: "" })];
    expect(trocasDoItem(t, 5)).toEqual([]);
    expect(itemDispensado(t, 5)).toBe(true);
    expect(itemDispensado(t, 6)).toBe(false);
  });
});

describe("itensResolvidos com N trocas e dispensa", () => {
  it("uma linha com duas trocas rende dois lançamentos", () => {
    const itens = [item({ id: 5 })];
    const t = [
      troca({ id: 1, item_id: 5, food_id: 42, qty_g: 100, nome: "Pão" }),
      troca({ id: 2, item_id: 5, food_id: 77, qty_g: 200, nome: "Suco" }),
    ];
    const { lancaveis } = itensResolvidos(itens, t);
    expect(lancaveis.map((l) => l.food_id)).toEqual([42, 77]);
  });

  it("linha dispensada sai das duas listas e entra em dispensados", () => {
    const itens = [item({ id: 5, food_id: 42, qty_g: 100 })];
    const t = [troca({ id: 1, item_id: 5, dispensado: true, nome: "" })];
    const r = itensResolvidos(itens, t);
    expect(r.lancaveis).toHaveLength(0);
    expect(r.semAlimento).toHaveLength(0);
    expect(r.dispensados.map((i) => i.id)).toEqual([5]);
  });

  it("item trocado nunca cai de volta no alimento original", () => {
    const itens = [item({ id: 5, food_id: 42, qty_g: 100 })];
    const t = [troca({ id: 1, item_id: 5, food_id: null, qty_g: null, nome: "Pão da padaria" })];
    const r = itensResolvidos(itens, t);
    expect(r.lancaveis).toHaveLength(0);
    expect(r.semAlimento.map((i) => i.id)).toEqual([5]);
  });
});

describe("kcalDaRefeicao", () => {
  it("soma as trocas e o que ficou do plano", () => {
    const itens = [item({ id: 5 }), item({ id: 6, food_id: 9, qty_g: 100, kcal_plano: 120 })];
    const t = [
      troca({ id: 1, item_id: 5, kcal: 210 }),
      troca({ id: 2, item_id: 5, kcal: 90 }),
    ];
    expect(kcalDaRefeicao(itens, t, new Map([[6, 120]]))).toEqual({ total: 420, incompleto: false });
  });

  it("linha dispensada não soma nada", () => {
    const itens = [item({ id: 5 })];
    const t = [troca({ id: 1, item_id: 5, dispensado: true, nome: "" })];
    expect(kcalDaRefeicao(itens, t, new Map())).toEqual({ total: 0, incompleto: false });
  });

  it("troca sem caloria marca a soma como incompleta", () => {
    const itens = [item({ id: 5 })];
    const t = [troca({ id: 1, item_id: 5, kcal: null, nome: "Pão da padaria" })];
    expect(kcalDaRefeicao(itens, t, new Map())).toEqual({ total: 0, incompleto: true });
  });
});
```

> **Nota de assinatura:** `kcalDaRefeicao` recebe um terceiro argumento,
> `kcalPorItem: Map<number, number>` — a caloria conhecida de cada linha
> INTACTA do plano. `PlanItem` não guarda kcal (só `food_id` e `qty_g`), e o
> domínio não consulta banco; quem monta o mapa é a tela, com os alimentos que
> já tem em mão. Linha intacta fora do mapa conta como desconhecida e liga
> `incompleto`.

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/domain/plano-dia.test.ts`
Esperado: FAIL — `trocasDoItem` não é exportada.

- [ ] **Passo 3: implementar**

Em `src/domain/plano-types.ts`, `TrocaDeItem` ganha:

```ts
  /** Você não comeu esta linha, e não comeu outra coisa no lugar. */
  dispensado: boolean;
```

Em `src/domain/plano-dia.ts`, substituir `trocaDoItem` por:

```ts
/**
 * As trocas de uma linha, na ordem em que foram escolhidas.
 *
 * Era `trocaDoItem`, no singular, porque a tabela tinha `UNIQUE (user_id,
 * data, item_id)`. Uma linha comporta N alimentos desde que trocar a refeição
 * inteira por duas coisas deixou de exigir inventar uma troca para cada linha.
 *
 * A dispensa fica de fora: ela mora na mesma tabela, mas não é uma troca —
 * é a ausência de uma.
 */
export function trocasDoItem(trocas: TrocaDeItem[], itemId: number): TrocaDeItem[] {
  return trocas.filter((t) => t.item_id === itemId && !t.dispensado);
}

/** A linha que você marcou como não comida. */
export function itemDispensado(trocas: TrocaDeItem[], itemId: number): boolean {
  return trocas.some((t) => t.item_id === itemId && t.dispensado);
}
```

`itensResolvidos` passa a três saídas:

```ts
export function itensResolvidos(
  itens: PlanItem[],
  trocas: TrocaDeItem[],
): { lancaveis: LancamentoDoPlano[]; semAlimento: PlanItem[]; dispensados: PlanItem[] } {
  const lancaveis: LancamentoDoPlano[] = [];
  const semAlimento: PlanItem[] = [];
  const dispensados: PlanItem[] = [];

  for (const item of itens) {
    // Dispensada não é nem lançável nem "sem alimento": dizer "não entra no
    // balanço" sobre algo que você deliberadamente não comeu é ruído.
    if (itemDispensado(trocas, item.id)) {
      dispensados.push(item);
      continue;
    }

    const doItem = trocasDoItem(trocas, item.id);
    // Item trocado só é lançado PELAS TROCAS. Cair de volta no alimento
    // original porque a troca não casou com o catálogo registraria uma
    // refeição que não aconteceu — e é justamente no dia em que você trocou
    // que o diário precisa estar certo.
    const fontes = doItem.length > 0
      ? doItem.map((t) => ({
          food_id: t.food_id, qty_g: t.qty_g,
          measure_id: t.measure_id, medidas: t.medidas, label: t.nome,
        }))
      : [{
          food_id: item.food_id, qty_g: item.qty_g,
          measure_id: null, medidas: null, label: item.texto,
        }];

    let algumaEntrou = false;
    for (const f of fontes) {
      if (f.food_id === null || f.qty_g === null || f.qty_g <= 0) continue;
      lancaveis.push({ item_id: item.id, ...f });
      algumaEntrou = true;
    }
    // A linha só é "sem alimento" quando NADA dela pôde ser lançado — com
    // duas trocas e só uma casando, o aviso mentiria sobre a que casou.
    if (!algumaEntrou) semAlimento.push(item);
  }

  return { lancaveis, semAlimento, dispensados };
}
```

E, no fim do arquivo:

```ts
/**
 * A caloria que a refeição de HOJE vai ter, contra a que o plano previa.
 *
 * `incompleto` é o que vira o "+" de "380+ / ~400": uma troca de texto sem
 * caloria, ou uma linha intacta cujo alimento o app não conhece, não podem
 * ser somadas — e calar isso contaria zero, que é uma afirmação diferente de
 * "não sei".
 *
 * `kcalPorItem` traz a caloria das linhas INTACTAS: `PlanItem` guarda
 * `food_id` e `qty_g`, não kcal, e o domínio não consulta banco. Quem monta o
 * mapa é a tela, com os alimentos que ela já tem em mão.
 */
export function kcalDaRefeicao(
  itens: PlanItem[],
  trocas: TrocaDeItem[],
  kcalPorItem: Map<number, number>,
): { total: number; incompleto: boolean } {
  let total = 0;
  let incompleto = false;

  for (const item of itens) {
    if (itemDispensado(trocas, item.id)) continue;

    const doItem = trocasDoItem(trocas, item.id);
    if (doItem.length > 0) {
      for (const t of doItem) {
        if (t.kcal === null) incompleto = true;
        else total += t.kcal;
      }
      continue;
    }

    const doPlano = kcalPorItem.get(item.id);
    if (doPlano === undefined) incompleto = true;
    else total += doPlano;
  }

  return { total: Math.round(total), incompleto };
}
```

- [ ] **Passo 4: consertar os chamadores e commitar**

`npm run build` aponta `bloco-card.tsx`, `sheet-trocas.tsx` e
`repositories/plano.ts`. Nesta tarefa, o mínimo para compilar — as telas são a
Task 4 e 5. Em `plano.ts`, `itensResolvidos` só usa `lancaveis`: nada muda.

```bash
git add src/domain/plano-types.ts src/domain/plano-dia.ts src/domain/plano-dia.test.ts
git commit -m "feat(plano): o domínio passa a falar de N trocas e de linha dispensada"
```

---

## Task 3: O repositório

**Arquivos**
- Modificar: `src/repositories/plano.ts` (`mapTroca` ~366, `SELECT_TROCAS` ~402, `salvarTroca` ~444)
- Modificar: `api/_lib/registro.ts`, `src/hooks/use-plano.ts`
- Teste: `src/repositories/plano.test.ts`

**Interfaces**
- Consome: Tasks 1–2.
- Produz:
  `adicionarTroca(db, userId, e: TrocaEntrada): Promise<void>`;
  `removerUmaTroca(db, userId, trocaId): Promise<void>`;
  `dispensarItem(db, userId, data, blockId, itemId): Promise<void>`;
  `removerTroca(db, userId, data, itemId)` — inalterada, limpa a linha inteira
  (trocas E dispensa);
  hooks `useAdicionarTroca`, `useRemoverUmaTroca`, `useDispensarItem`,
  `useLimparTrocasDoItem`.

- [ ] **Passo 1: os testes que falham**

```ts
describe("trocas: N por linha e a dispensa", () => {
  it("duas chamadas no mesmo item deixam duas linhas", async () => {
    await adicionarTroca(db, USER, { data: DIA, block_id: 10, item_id: 5, food_id: 1, qty_g: 100, kcal: 128 });
    await adicionarTroca(db, USER, { data: DIA, block_id: 10, item_id: 5, food_id: 2, qty_g: 50, kcal: 90 });

    const t = await listTrocasDoDia(db, USER, DIA);
    expect(t.filter((x) => x.item_id === 5)).toHaveLength(2);
  });

  it("dispensar apaga as trocas da linha", async () => {
    await adicionarTroca(db, USER, { data: DIA, block_id: 10, item_id: 5, food_id: 1, qty_g: 100, kcal: 128 });
    await dispensarItem(db, USER, DIA, 10, 5);

    const t = await listTrocasDoDia(db, USER, DIA);
    expect(t).toHaveLength(1);
    expect(t[0].dispensado).toBe(true);
  });

  it("trocar apaga a dispensa", async () => {
    await dispensarItem(db, USER, DIA, 10, 5);
    await adicionarTroca(db, USER, { data: DIA, block_id: 10, item_id: 5, food_id: 1, qty_g: 100, kcal: 128 });

    const t = await listTrocasDoDia(db, USER, DIA);
    expect(t).toHaveLength(1);
    expect(t[0].dispensado).toBe(false);
  });

  it("removerUmaTroca tira uma e deixa as outras", async () => {
    await adicionarTroca(db, USER, { data: DIA, block_id: 10, item_id: 5, food_id: 1, qty_g: 100, kcal: 128 });
    await adicionarTroca(db, USER, { data: DIA, block_id: 10, item_id: 5, food_id: 2, qty_g: 50, kcal: 90 });
    const antes = await listTrocasDoDia(db, USER, DIA);

    await removerUmaTroca(db, USER, antes[0].id);

    const depois = await listTrocasDoDia(db, USER, DIA);
    expect(depois.map((x) => x.id)).toEqual([antes[1].id]);
  });

  it("um usuário não apaga a troca do outro", async () => {
    await adicionarTroca(db, USER, { data: DIA, block_id: 10, item_id: 5, food_id: 1, qty_g: 100, kcal: 128 });
    const [t] = await listTrocasDoDia(db, USER, DIA);

    await removerUmaTroca(db, OUTRO, t.id);

    expect(await listTrocasDoDia(db, USER, DIA)).toHaveLength(1);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/repositories/plano.test.ts -t "N por linha"`
Esperado: FAIL — `adicionarTroca` não é exportada.

- [ ] **Passo 3: implementar**

`mapTroca` ganha o campo, e a origem passa a tratar a dispensa:

```ts
  const dispensado = Number(r.dispensado ?? 0) === 1;
  // Uma dispensa não tem origem. "texto" é o valor inerte que o tipo exige;
  // as telas testam `dispensado` antes de olhar para `origem`.
  const origem: TrocaDeItem["origem"] =
    swapId !== null ? "plano" : foodProprio !== null ? "catalogo" : "texto";
```
e `dispensado` no objeto devolvido.

`SELECT_TROCAS` fecha com `ORDER BY t.item_id, t.id` — a ordem de escolha é a
ordem que a tela mostra.

`salvarTroca` vira:

```ts
/**
 * Acrescenta um alimento à linha. NÃO substitui o que já estava lá.
 *
 * Era um upsert sobre `UNIQUE (user_id, data, item_id)`, e por isso trocar de
 * novo corrigia a troca anterior — o que impedia dizer "comi pão E suco no
 * lugar dos ovos". Corrigir passou a ser remover e escolher de novo, que é o
 * que a lista de escolhidos da folha oferece.
 *
 * Apaga a dispensa da linha: escolher um alimento é dizer que você comeu
 * algo ali, e as duas afirmações não coexistem.
 */
export async function adicionarTroca(
  db: Client,
  userId: number,
  e: TrocaEntrada,
): Promise<void> {
  await db.batch([
    {
      sql: `DELETE FROM plan_item_swaps
            WHERE user_id=? AND data=? AND item_id=? AND dispensado=1`,
      args: [userId, e.data, e.item_id] as (number | string | null)[],
    },
    {
      sql: `INSERT INTO plan_item_swaps
              (user_id, data, block_id, item_id, swap_id, food_id, texto,
               qty_g, measure_id, medidas, kcal, dispensado, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      args: [
        userId, e.data, e.block_id, e.item_id,
        e.swap_id ?? null, e.food_id ?? null, e.texto ?? null,
        e.qty_g ?? null, e.measure_id ?? null, e.medidas ?? null, e.kcal ?? null,
        new Date().toISOString(),
      ] as (number | string | null)[],
    },
  ], "write");
}

/** Tira UM alimento da linha, deixando os outros. */
export async function removerUmaTroca(
  db: Client,
  userId: number,
  trocaId: number,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM plan_item_swaps WHERE id=? AND user_id=?",
    args: [trocaId, userId],
  });
}

/**
 * "Não comi esta linha."
 *
 * Apaga as trocas antes de gravar: dispensa e troca são afirmações opostas
 * sobre a mesma linha, e o índice único parcial só garante que não há DUAS
 * dispensas — a exclusão mútua com as trocas é daqui.
 */
export async function dispensarItem(
  db: Client,
  userId: number,
  data: string,
  blockId: number,
  itemId: number,
): Promise<void> {
  await db.batch([
    {
      sql: "DELETE FROM plan_item_swaps WHERE user_id=? AND data=? AND item_id=?",
      args: [userId, data, itemId] as (number | string | null)[],
    },
    {
      sql: `INSERT INTO plan_item_swaps
              (user_id, data, block_id, item_id, dispensado, created_at)
            VALUES (?, ?, ?, ?, 1, ?)`,
      args: [userId, data, blockId, itemId, new Date().toISOString()] as (number | string | null)[],
    },
  ], "write");
}
```

- [ ] **Passo 4: registro e hooks**

`api/_lib/registro.ts`: `plano.salvarTroca` sai; entram
`plano.adicionarTroca`, `plano.removerUmaTroca`, `plano.dispensarItem`
(`plano.removerTroca` já está lá).

Em `src/hooks/use-plano.ts`, `useSalvarTroca` — que hoje faz as duas coisas
por um `if` no argumento — vira quatro hooks de uma linha cada, sobre uma
ajudante comum que invalida `trocas`, `checks` e `entries` do dia:

```ts
/**
 * Toda escrita de troca mexe nas mesmas três chaves: a troca em si, o check
 * do bloco (marcar "Comi" relança o diário) e as entries do dia.
 */
function useEscritaDeTroca<T>(data: string, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE.trocas(data) });
      qc.invalidateQueries({ queryKey: CHAVE.checks(data) });
      qc.invalidateQueries({ queryKey: ["entries", data] });
    },
  });
}

export function useAdicionarTroca(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (e: TrocaEntrada) => api["plano"].adicionarTroca(e));
}

export function useRemoverUmaTroca(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (trocaId: number) => api["plano"].removerUmaTroca(trocaId));
}

export function useDispensarItem(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (v: { blockId: number; itemId: number }) =>
    api["plano"].dispensarItem(data, v.blockId, v.itemId));
}

export function useLimparTrocasDoItem(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (itemId: number) => api["plano"].removerTroca(data, itemId));
}
```

- [ ] **Passo 5: rodar tudo e commitar**

```bash
git add src/repositories/plano.ts src/repositories/plano.test.ts \
        api/_lib/registro.ts src/hooks/use-plano.ts
git commit -m "feat(plano): trocar passa a acrescentar, e a linha pode ser dispensada"
```

---

## Task 4: A folha de trocas

**Arquivos**
- Modificar: `src/components/plano/sheet-trocas.tsx`
- Modificar: `src/pages/dashboard.tsx` (liga os hooks novos)
- Teste: `src/components/plano/sheet-trocas.test.tsx`

**Interfaces**
- Consome: Tasks 1–3.
- Produz: `SheetTrocas` com props novas — `onAdicionar(itemId, entrada)`,
  `onRemoverUma(trocaId)`, `onDispensar(itemId)`, `onLimpar(itemId)` no lugar
  de `onTrocar`/`onDesfazer`.

- [ ] **Passo 1: os testes que falham**

```ts
describe("SheetTrocas — mais de um alimento por linha", () => {
  it("com uma escolha feita, o botão passa a dizer Adicionar", async () => {
    const user = userEvent.setup();
    montar({
      trocas: [troca({ item_id: 2, origem: "catalogo", nome: "Tapioca goma", food_id: 1, qty_g: 30, kcal: 72 })],
    });
    await user.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));
    await user.click(screen.getByRole("tab", { name: "Catálogo" }));
    await user.type(screen.getByLabelText(/alimento/i), "tapioca");
    await user.click(await screen.findByRole("button", { name: /tapioca goma/i }));

    expect(await screen.findByRole("button", { name: /^adicionar tapioca goma$/i })).toBeInTheDocument();
  });

  it("as escolhas já feitas aparecem na folha da linha, com o × de cada uma", async () => {
    const user = userEvent.setup();
    const { onRemoverUma } = montar({
      trocas: [
        troca({ id: 91, item_id: 2, nome: "Pão na chapa", kcal: 210 }),
        troca({ id: 92, item_id: 2, nome: "Suco de laranja", kcal: 90 }),
      ],
    });
    await user.click(screen.getByRole("button", { name: /trocar 1 fatia de pão integral/i }));

    await user.click(screen.getByRole("button", { name: /remover suco de laranja/i }));
    expect(onRemoverUma).toHaveBeenCalledWith(92);
  });

  it("a refeição empilha as N trocas sob o item riscado", () => {
    montar({
      trocas: [
        troca({ id: 91, item_id: 2, nome: "Pão na chapa", kcal: 210 }),
        troca({ id: 92, item_id: 2, nome: "Suco de laranja", kcal: 90 }),
      ],
    });
    expect(screen.getByText(/Pão na chapa · 210 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/Suco de laranja · 90 kcal/)).toBeInTheDocument();
  });

  it("dispensar a linha avisa quem monta a tela", async () => {
    const user = userEvent.setup();
    const { onDispensar } = montar();
    await user.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await user.click(screen.getByRole("button", { name: /não comi esta linha/i }));
    expect(onDispensar).toHaveBeenCalledWith(1);
  });

  it("linha dispensada aparece como tal, e dá para voltar ao plano", async () => {
    const user = userEvent.setup();
    const { onLimpar } = montar({
      trocas: [troca({ id: 93, item_id: 1, dispensado: true, nome: "" })],
    });
    expect(screen.getByText(/dispensado/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /trocar 3 ovos mexidos/i }));
    await user.click(screen.getByRole("button", { name: /voltar ao plano/i }));
    expect(onLimpar).toHaveBeenCalledWith(1);
  });

  it("confirmar não avança sozinho: a linha pode receber outro alimento", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /trocar tudo/i }));
    await user.click(screen.getByRole("tab", { name: "Catálogo" }));
    await user.type(screen.getByLabelText(/alimento/i), "tapioca");
    await user.click(await screen.findByRole("button", { name: /tapioca goma/i }));
    const qtd = screen.getByLabelText(/quantidade/i);
    await waitFor(() => expect(qtd).toHaveValue("1"));
    await user.click(screen.getByRole("button", { name: /trocar por tapioca goma/i }));

    // Continua no item 1, e agora existe o caminho explícito para o próximo.
    expect(screen.getByText(/item 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /próximo item/i })).toBeInTheDocument();
  });
});
```

> O helper `troca()` do arquivo ganha `dispensado: false` no default.
> O helper `montar()` passa a devolver `onAdicionar`, `onRemoverUma`,
> `onDispensar` e `onLimpar`; os testes que hoje esperam `onTrocar` passam a
> esperar `onAdicionar` com os mesmos argumentos.

- [ ] **Passo 2: rodar e ver falhar**

`NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/plano/sheet-trocas.test.tsx`

- [ ] **Passo 3: `TrocarItem` — a lista, o verbo, a dispensa**

Props novas: `escolhidas: TrocaDeItem[]`, `dispensado: boolean`,
`onRemoverUma`, `onDispensar`, `onVoltarAoPlano`, `onProximo`.

Acima do `Segmented`, quando houver escolhas:

```tsx
        {escolhidas.length > 0 && (
          /* A lista é o que substitui a rede que o `UNIQUE` dava: sem ele,
             dois toques rápidos gravam duas linhas iguais — e aqui isso fica
             visível, e desfazível num toque. */
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {escolhidas.map((t) => (
              <li key={t.id} className="flex items-center gap-1 pr-2">
                <span className="min-w-0 flex-1 py-2.5 pl-4 text-sm">{descreverTroca(t)}</span>
                <button
                  type="button"
                  onClick={() => onRemoverUma(t.id)}
                  aria-label={`Remover ${t.nome}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
```

O verbo do botão do catálogo (e o do "Do plano" e o de "Escrever") passa a
depender de já haver escolha:

```tsx
  // "Trocar" pela segunda vez sugeriria substituir a primeira. O verbo tem
  // que dizer o que o toque faz.
  const verbo = escolhidas.length > 0 ? "Adicionar" : "Trocar por";
```
— usado como `{verbo} {alimento.nome}` no botão do catálogo, e "Adicionar" /
"Trocar" no botão da aba de texto.

No rodapé da folha da linha:

```tsx
        {dispensado ? (
          <Button variant="outline" block onClick={onVoltarAoPlano}>
            Voltar ao plano
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => onDispensar()}
            className="flex min-h-11 w-full items-center justify-center text-[0.8125rem] font-medium text-muted-foreground"
          >
            Não comi esta linha
          </button>
        )}
        {passo && (
          <Button variant="outline" block onClick={onProximo}>
            Próximo item
          </Button>
        )}
```

- [ ] **Passo 4: `SheetTrocas` — parar de avançar sozinho**

`escolher` deixa de chamar `avancar()`: com N alimentos por linha, avançar ao
confirmar impede o segundo. `avancar` passa a ser chamada só por "Próximo
item".

```tsx
  function escolher(itemId: number, e: Omit<TrocaEntrada, "data" | "block_id" | "item_id">) {
    // Não avança mais sozinho: avançar era certo quando a linha comportava
    // uma resposta só, e agora impediria a segunda.
    onAdicionar(itemId, e);
  }
```

Na lista da refeição, o item passa a mapear as N trocas:

```tsx
                    const doItem = trocasDoItem(trocas, item.id);
                    const dispensado = itemDispensado(trocas, item.id);
```
e, sob o texto riscado, `doItem.map((t) => <span key={t.id}>{descreverTroca(t)}</span>)`,
ou `<span className="t-caption">dispensado</span>` quando for o caso.

- [ ] **Passo 5: `dashboard.tsx` liga os hooks e commita**

```tsx
  const adicionarTroca = useAdicionarTroca(data);
  const removerUmaTroca = useRemoverUmaTroca(data);
  const dispensarItem = useDispensarItem(data);
  const limparTrocas = useLimparTrocasDoItem(data);
```
e as quatro props da `SheetTrocas`.

```bash
git add src/components/plano/sheet-trocas.tsx src/components/plano/sheet-trocas.test.tsx src/pages/dashboard.tsx
git commit -m "feat(plano): a linha aceita vários alimentos, e dá para dispensá-la"
```

---

## Task 5: A caloria realizada no card

**Arquivos**
- Modificar: `src/components/plano/bloco-card.tsx` (kcal ~106, itens ~149)
- Modificar: `src/pages/dashboard.tsx` (monta `kcalPorItem`)
- Teste: `src/components/plano/bloco-card.test.tsx`

**Interfaces**
- Consome: Tasks 1–4.
- Produz: `BlocoCard` com a prop `kcalPorItem?: Map<number, number>`.

- [ ] **Passo 1: os testes que falham**

```ts
describe("BlocoCard — a caloria depois da troca", () => {
  it("sem troca, mostra só a meta do plano", () => {
    montar({ trocas: [] });
    expect(screen.getByText("~400 kcal")).toBeInTheDocument();
  });

  it("com troca, mostra o realizado contra a meta", () => {
    montar({ trocas: [troca({ item_id: 1, nome: "Pão", kcal: 380 })] });
    expect(screen.getByText("380 / ~400 kcal")).toBeInTheDocument();
  });

  it("estourando a meta, avisa", () => {
    montar({ trocas: [troca({ item_id: 1, nome: "Lanche", kcal: 510 })] });
    const alvo = screen.getByText("510 / ~400 kcal");
    expect(alvo.className).toContain("text-warning");
  });

  it("com parcela desconhecida, o número ganha o +", () => {
    montar({
      trocas: [
        troca({ item_id: 1, nome: "Pão", kcal: 380 }),
        troca({ item_id: 2, nome: "Pão da padaria", kcal: null }),
      ],
    });
    expect(screen.getByText("380+ / ~400 kcal")).toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/plano/bloco-card.test.tsx`

- [ ] **Passo 3: implementar**

```tsx
  /**
   * A caloria do card conta o que você vai comer, não o que o plano previa.
   *
   * Era sempre `kcal_alvo` — a meta da planilha —, então trocar 400 kcal de
   * café da manhã por um lanche de 700 não mudava nada na tela, justamente no
   * momento em que mudar importa. Sem troca nenhuma a meta continua sozinha:
   * ela é uma afirmação melhor sobre um dia intacto do que a soma parcial das
   * linhas que o importador conseguiu casar com o catálogo.
   */
  const temTroca = trocas.some((t) => t.block_id === bloco.id);
  const realizado = temTroca ? kcalDaRefeicao(itens, trocas, kcalPorItem) : null;
  const estourou =
    realizado !== null && bloco.kcal_alvo != null && realizado.total > bloco.kcal_alvo;
```

e, no lugar do `<span>` da caloria:

```tsx
            <span
              className={cn("t-caption shrink-0 tabular-nums", estourou && "text-warning")}
            >
              {realizado !== null && bloco.kcal_alvo != null
                ? `${realizado.total}${realizado.incompleto ? "+" : ""} / ~${bloco.kcal_alvo} kcal`
                : bloco.kcal_alvo != null && `~${bloco.kcal_alvo} kcal`}
              {ehAgua && metaAgua > 0 && `${aguaNoBloco} / ${metaAgua} ml`}
            </span>
```

A lista de itens do card usa `trocasDoItem` e `itemDispensado`, como a folha.

- [ ] **Passo 4: o mapa, no dashboard**

```tsx
  /**
   * A caloria conhecida de cada linha INTACTA do plano.
   *
   * `PlanItem` guarda `food_id` e `qty_g`, não kcal, e o domínio não consulta
   * banco — então quem monta o mapa é aqui, com os alimentos que a tela já
   * carregou. Linha fora do mapa conta como desconhecida, e é o que faz o
   * card dizer "380+" em vez de mentir um total fechado.
   */
  const kcalPorItem = useMemo(() => {
    const m = new Map<number, number>();
    for (const itens of itensPorBloco?.values() ?? []) {
      for (const i of itens) {
        if (i.food_id === null || i.qty_g === null) continue;
        const f = foodsDoPlano?.get(i.food_id);
        if (f) m.set(i.id, macrosDoEntry(f, i.qty_g).kcal);
      }
    }
    return m;
  }, [itensPorBloco, foodsDoPlano]);
```

`foodsDoPlano` vem de `useFoodsByIds` com os `food_id` das linhas do plano.

- [ ] **Passo 5: rodar tudo e commitar**

```bash
npm test && npm run build
git add src/components/plano/bloco-card.tsx src/components/plano/bloco-card.test.tsx src/pages/dashboard.tsx
git commit -m "feat(plano): o card conta a caloria que você vai comer, não a que o plano previa"
```

---

## Verificação final

- [ ] `npm test` verde, `npm run build` limpo.
- [ ] `npm run db:setup` no banco local: a reconstrução roda, e as 11 trocas de
      31/08 continuam lá com `dispensado = 0`. Rodar de novo não muda nada.
- [ ] No navegador (`turso dev` + `npm run dev`, usuário `claude-qa`):
  - Trocar uma linha por dois alimentos; os dois aparecem empilhados.
  - Remover um dos dois; o outro fica.
  - Dispensar uma linha; ela some do "não entra no balanço" e do diário.
  - O card mostra `X / ~400 kcal`, com aviso ao estourar.
  - "Comi" lança uma entry por alimento escolhido.
