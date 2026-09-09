# Trocar a refeição inteira — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar à refeição um segundo escopo de troca — uma lista livre de N alimentos que substitui o bloco inteiro, sem relação com as linhas do plano.

**Architecture:** `plan_item_swaps.item_id` passa a aceitar `NULL`, e `NULL` quer dizer "esta troca substitui a REFEIÇÃO, não uma linha". O domínio ganha duas funções de leitura e um curto-circuito nas duas que somam o dia; o repositório ganha duas escritas; a folha ganha um terceiro nível, e o formulário das três abas — hoje dentro de `TrocarItem` — vira um componente compartilhado.

**Tech Stack:** TypeScript 5.9 strict · React 19 + Vite · TanStack Query · libSQL/Turso · Vitest + Testing Library · Tailwind 4

**Spec:** `docs/superpowers/specs/2026-09-09-trocar-refeicao-inteira-design.md`

## Global Constraints

- Comentários, documentação e textos de tela em **português brasileiro com acentos**; identificadores em inglês.
- Nada de `console.log` em código de servidor; em componentes de cliente `console.error` é aceito.
- Dependências só via `pnpm add`. **Este plano não adiciona nenhuma.**
- Verificação ao fim de cada task: `pnpm test`. Ao fim do plano: `pnpm lint && pnpm format:check && pnpm type-check && pnpm test`.
- Commits em português, um por task, no formato `tipo(escopo): frase em minúscula`.
- Toda troca da refeição tem `item_id = NULL`; **toda dispensa tem `item_id` não nulo** — dispensa é só de linha.

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
| --- | --- | --- |
| `src/db/schema.sql` | `item_id` nulável, `CHECK` exigindo `item_id` na dispensa | 1 |
| `scripts/lib/apply-schema.ts` | 2ª entrada em `REBUILDS` | 1 |
| `scripts/lib/apply-schema.test.ts` | a reconstrução em sequência | 1 |
| `src/domain/plano-types.ts` | `TrocaDeItem` → `Troca`, `item_id: number \| null` | 2 |
| `src/domain/plano-dia.ts` | `trocasDaRefeicao`, `refeicaoSubstituida`, `refeicaoResolvida`, `kcalDaRefeicao` | 2 |
| `src/repositories/plano.ts` | `adicionarTrocaDaRefeicao`, `limparRefeicao` | 3 |
| `api/_lib/registro.ts` | as duas operações novas | 3 |
| `src/hooks/use-plano.ts` | os dois hooks novos | 3 |
| `src/components/plano/escolher-alimento.tsx` | **novo** — as três abas, compartilhadas | 4 |
| `src/components/plano/trocar-item.tsx` | **novo** — nível 2, recorte sem mudança | 4 |
| `src/components/plano/trocar-refeicao.tsx` | **novo** — nível 3 | 5 |
| `src/components/plano/sheet-trocas.tsx` | nível 1: rodapé de dois botões, estado substituída | 5, 6 |
| `src/components/plano/bloco-card.tsx` | o card desenha a refeição substituída | 6 |
| `src/pages/dashboard.tsx` | fiação dos dois callbacks novos | 5 |

---

## Task 1: O esquema aceita `item_id` nulo

**Files:**
- Modify: `src/db/schema.sql:341-371`
- Modify: `scripts/lib/apply-schema.ts:117-171` (o array `REBUILDS`)
- Test: `scripts/lib/apply-schema.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `plan_item_swaps` aceita `item_id NULL` em linhas com `dispensado = 0`, e recusa `item_id NULL` com `dispensado = 1`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `scripts/lib/apply-schema.test.ts`, depois do `describe` que já existe:

```ts
describe("applyAdditiveColumns — plan_item_swaps com troca da refeição", () => {
  it("aceita uma troca sem item: ela substitui a refeição inteira", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    await db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, food_id, qty_g, kcal, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, NULL, 77, 300, 480, 't', 0)`);

    const rs = await db.execute(
      "SELECT COUNT(*) AS n FROM plan_item_swaps WHERE item_id IS NULL",
    );
    expect(Number(rs.rows[0].n)).toBe(1);
  });

  it("aceita várias trocas da mesma refeição — é uma lista, não uma correção", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    await db.executeMultiple(`
      INSERT INTO plan_item_swaps
        (user_id, data, block_id, item_id, food_id, qty_g, kcal, created_at, dispensado)
        VALUES (1, '2026-08-31', 10, NULL, 77, 300, 480, 't', 0);
      INSERT INTO plan_item_swaps
        (user_id, data, block_id, item_id, texto, kcal, created_at, dispensado)
        VALUES (1, '2026-08-31', 10, NULL, 'Sorvete da esquina', NULL, 't', 0);
    `);

    const rs = await db.execute(
      "SELECT COUNT(*) AS n FROM plan_item_swaps WHERE item_id IS NULL",
    );
    expect(Number(rs.rows[0].n)).toBe(2);
  });

  it("recusa dispensa sem item: não se dispensa uma refeição, só uma linha", async () => {
    // "Não comi esta refeição" já tem resposta: é não marcar "Comi". Uma
    // dispensa de bloco seria uma segunda maneira de dizer o mesmo, e as duas
    // discordariam no dia em que alguém usasse só uma.
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    await expect(db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, NULL, 't', 1)`)).rejects.toThrow();
  });

  it("um banco no formato mais antigo atravessa as duas reconstruções", async () => {
    // A primeira tira o UNIQUE e produz `item_id INTEGER NOT NULL`, que é
    // exatamente o que a segunda reconhece. A ordem no array é o que faz isso
    // funcionar numa passada só.
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);

    const rs = await db.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='plan_item_swaps'",
    );
    const ddl = rs.rows[0].sql as string;
    expect(ddl).not.toMatch(/UNIQUE\s*\(\s*user_id/i);
    expect(ddl).not.toMatch(/item_id\s+INTEGER\s+NOT\s+NULL/i);
    expect(ddl).toMatch(/dispensado/i);
  });

  it("rodar de novo depois das duas não mexe em nada", async () => {
    const db = await bancoComTrocasAntigas();
    await applyAdditiveColumns(db);
    await db.execute(`INSERT INTO plan_item_swaps
      (user_id, data, block_id, item_id, food_id, qty_g, kcal, created_at, dispensado)
      VALUES (1, '2026-08-31', 10, NULL, 77, 300, 480, 't', 0)`);

    await applyAdditiveColumns(db);

    const rs = await db.execute("SELECT COUNT(*) AS n FROM plan_item_swaps");
    expect(Number(rs.rows[0].n)).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run scripts/lib/apply-schema.test.ts`
Expected: FAIL — os três primeiros com `NOT NULL constraint failed: plan_item_swaps.item_id` / o `.rejects.toThrow()` passando por engano no motivo errado, e o de DDL com `item_id INTEGER NOT NULL` ainda presente.

- [ ] **Step 3: Soltar o `NOT NULL` no `schema.sql`**

Em `src/db/schema.sql`, na tabela `plan_item_swaps`, trocar a linha do `item_id` e o `CHECK`:

```sql
  item_id    INTEGER,                      -- plan_items.id: QUAL linha foi trocada.
                                           -- NULL = a troca é da REFEIÇÃO inteira:
                                           -- uma lista nova no lugar do bloco, sem
                                           -- relação com as linhas do plano.
```

```sql
  CHECK (
    -- A dispensa é sempre de uma LINHA. "Não comi esta refeição" já tem
    -- resposta no app: é não marcar "Comi".
    (dispensado = 1 AND item_id IS NOT NULL
     AND swap_id IS NULL AND food_id IS NULL AND texto IS NULL)
    OR
    (dispensado = 0
     AND (swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
  ),
```

- [ ] **Step 4: Acrescentar a segunda reconstrução**

Em `scripts/lib/apply-schema.ts`, dentro de `REBUILDS`, **depois** da entrada que já existe (a ordem é o que faz um banco antigo atravessar as duas numa passada só):

```ts
  {
    // A troca era sempre de uma LINHA (`item_id NOT NULL`), e a lista nova de
    // uma refeição inteira não cabia: três alimentos no lugar de cinco linhas
    // exigia pendurar os três numa linha e dispensar as outras quatro, o que
    // afirma que a pizza substituiu o arroz quando ela substituiu o almoço.
    // `item_id NULL` passa a dizer "esta troca substitui o bloco".
    table: "plan_item_swaps",
    obsoleto: /item_id\s+INTEGER\s+NOT\s+NULL/i,
    passos: [
      `CREATE TABLE plan_item_swaps_nova (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL, data TEXT NOT NULL,
         block_id INTEGER NOT NULL, item_id INTEGER,
         swap_id INTEGER, food_id INTEGER, texto TEXT,
         qty_g REAL, measure_id INTEGER, medidas REAL, kcal REAL,
         dispensado INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL,
         CHECK (
           (dispensado = 1 AND item_id IS NOT NULL
            AND swap_id IS NULL AND food_id IS NULL AND texto IS NULL)
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
      // Toda linha já gravada tinha `item_id`, e continua tendo: nenhuma troca
      // muda de sentido ao atravessar.
      `INSERT INTO plan_item_swaps_nova
         (id, user_id, data, block_id, item_id, swap_id, food_id, texto,
          qty_g, measure_id, medidas, kcal, dispensado, created_at)
       SELECT id, user_id, data, block_id, item_id, swap_id, food_id, texto,
              qty_g, measure_id, medidas, kcal, dispensado, created_at
         FROM plan_item_swaps`,
      `DROP TABLE plan_item_swaps`,
      `ALTER TABLE plan_item_swaps_nova RENAME TO plan_item_swaps`,
      `CREATE INDEX IF NOT EXISTS idx_plan_item_swaps_dia
         ON plan_item_swaps (user_id, data)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_item_swaps_dispensa
         ON plan_item_swaps (user_id, data, item_id) WHERE dispensado = 1`,
    ],
  },
```

- [ ] **Step 5: Rodar os testes do schema**

Run: `pnpm vitest run scripts/lib/apply-schema.test.ts`
Expected: PASS — os cinco novos e os cinco que já existiam.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.sql scripts/lib/apply-schema.ts scripts/lib/apply-schema.test.ts
git commit -m "feat(plano): a troca pode ser da refeição inteira, não só de uma linha"
```

---

## Task 2: O domínio fala de troca da refeição

**Files:**
- Modify: `src/domain/plano-types.ts:75-110` (`TrocaDeItem`), `:111-119` (`LancamentoDoPlano`)
- Modify: `src/domain/plano-dia.ts:200-299`
- Modify (rename mecânico): `src/repositories/plano.ts`, `src/components/plano/bloco-card.tsx`, `src/components/plano/sheet-trocas.tsx`, `src/components/plano/sheet-trocas.test.tsx`, `src/components/plano/bloco-card.test.tsx`
- Test: `src/domain/plano-dia.test.ts`

**Interfaces:**
- Consumes: `plan_item_swaps.item_id` nulável (Task 1).
- Produces:
  - `type Troca` (era `TrocaDeItem`), com `item_id: number | null`
  - `LancamentoDoPlano.item_id: number | null`
  - `trocasDaRefeicao(trocas: Troca[], blockId: number): Troca[]`
  - `refeicaoSubstituida(trocas: Troca[], blockId: number): boolean`
  - `refeicaoResolvida(itens: PlanItem[], trocas: Troca[], blockId: number): { lancaveis: LancamentoDoPlano[]; semAlimento: PlanItem[]; dispensados: PlanItem[]; naoContadas: Troca[] }` (era `itensResolvidos`, sem `naoContadas` e sem `blockId`)
  - `kcalDaRefeicao(itens: PlanItem[], trocas: Troca[], kcalPorItem: Map<number, number>, blockId: number): { total: number; incompleto: boolean }`

- [ ] **Step 1: Fazer o rename mecânico primeiro**

O rename não muda comportamento e deixa os testes verdes; fazê-lo antes separa o ruído do trabalho.

```bash
cd /home/luis_promedico/Documents/Softwares/LuisMarchio03/Projects/Macronaut
grep -rl "TrocaDeItem" src api | xargs sed -i 's/\bTrocaDeItem\b/Troca/g'
grep -rl "itensResolvidos" src api | xargs sed -i 's/\bitensResolvidos\b/refeicaoResolvida/g'
pnpm vitest run src/domain/plano-dia.test.ts
```

Depois, em `src/domain/plano-types.ts`, ajustar o comentário do tipo e o campo:

```ts
/**
 * Uma troca de um dia, já resolvida para a tela.
 *
 * Denormalizada de propósito: `plan_item_swaps` guarda só a referência, e
 * `nome`/`porcao` moram em três tabelas diferentes conforme a origem. Sem isto
 * toda tela que desenha uma troca precisaria saber fazer o mesmo join.
 */
export interface Troca {
  id: number;
  data: string;
  block_id: number;
  /**
   * A linha que ela substitui — ou `null`, e aí ela substitui a REFEIÇÃO.
   *
   * As duas moram na mesma tabela porque são a mesma afirmação ("no lugar
   * disto, comi aquilo") em escopos diferentes. O que muda é o que ela apaga:
   * uma lista de refeição varre as trocas de linha do bloco, porque uma
   * refeição está num modo ou no outro.
   */
  item_id: number | null;
```

E em `LancamentoDoPlano`:

```ts
export interface LancamentoDoPlano {
  /** `null` quando o lançamento veio da lista que substituiu a refeição. */
  item_id: number | null;
```

- [ ] **Step 2: Escrever os testes que falham**

Em `src/domain/plano-dia.test.ts`, acrescentar a fábrica de troca da refeição logo depois da fábrica `troca` (linha ~270):

```ts
/** Uma troca da REFEIÇÃO inteira — o `item_id` nulo é o que diz isso. */
const trocaRef = (p: Partial<Troca> & { id: number }): Troca => ({
  data: "2026-08-31",
  block_id: 1,
  item_id: null,
  origem: "catalogo",
  swap_id: null,
  nome: "Pizza",
  porcao: null,
  kcal: null,
  food_id: null,
  qty_g: null,
  measure_id: null,
  medidas: null,
  dispensado: false,
  ...p,
});
```

E os `describe` novos ao fim do arquivo:

```ts
describe("trocasDaRefeicao e refeicaoSubstituida", () => {
  it("devolve só as trocas sem item, do bloco pedido, na ordem", () => {
    const t = [
      troca({ id: 1, item_id: 5, nome: "Pão" }),
      trocaRef({ id: 2, nome: "Pizza" }),
      trocaRef({ id: 3, nome: "Refrigerante" }),
      trocaRef({ id: 4, block_id: 2, nome: "Sopa" }),
    ];
    expect(trocasDaRefeicao(t, 1).map((x) => x.nome)).toEqual(["Pizza", "Refrigerante"]);
    expect(trocasDaRefeicao(t, 2).map((x) => x.nome)).toEqual(["Sopa"]);
  });

  it("uma troca da refeição não vaza para linha nenhuma", () => {
    // `null` nunca é igual a um número, e é isso que mantém os dois escopos
    // separados sem ninguém precisar se lembrar disso.
    const t = [trocaRef({ id: 1 })];
    expect(trocasDoItem(t, 5)).toEqual([]);
    expect(itemDispensado(t, 5)).toBe(false);
  });

  it("substituída é ter pelo menos um alimento na lista", () => {
    expect(refeicaoSubstituida([troca({ id: 1, item_id: 5 })], 1)).toBe(false);
    expect(refeicaoSubstituida([trocaRef({ id: 1 })], 1)).toBe(true);
    expect(refeicaoSubstituida([trocaRef({ id: 1, block_id: 2 })], 1)).toBe(false);
  });
});

describe("refeicaoResolvida com a refeição substituída", () => {
  it("lança a lista nova e ignora as linhas do plano", () => {
    // Cair de volta nas linhas registraria um almoço que não aconteceu — a
    // mesma regra da linha trocada, um nível acima.
    const itens = [item({ id: 5, food_id: 42, qty_g: 100 }), item({ id: 6, food_id: 43, qty_g: 50 })];
    const t = [
      trocaRef({ id: 1, food_id: 77, qty_g: 300, nome: "Pizza" }),
      trocaRef({ id: 2, food_id: 88, qty_g: 350, nome: "Refrigerante" }),
    ];
    const r = refeicaoResolvida(itens, t, 1);

    expect(r.lancaveis.map((l) => l.food_id)).toEqual([77, 88]);
    expect(r.lancaveis.map((l) => l.item_id)).toEqual([null, null]);
    expect(r.semAlimento).toEqual([]);
    expect(r.dispensados).toEqual([]);
    expect(r.naoContadas).toEqual([]);
  });

  it("o texto livre sem alimento vai para naoContadas, não some calado", () => {
    const itens = [item({ id: 5, food_id: 42, qty_g: 100 })];
    const t = [
      trocaRef({ id: 1, food_id: 77, qty_g: 300, nome: "Pizza" }),
      trocaRef({ id: 2, origem: "texto", nome: "Sorvete da esquina" }),
    ];
    const r = refeicaoResolvida(itens, t, 1);

    expect(r.lancaveis).toHaveLength(1);
    expect(r.naoContadas.map((x) => x.nome)).toEqual(["Sorvete da esquina"]);
  });

  it("sem substituição, naoContadas vem vazio e nada mais muda", () => {
    const itens = [item({ id: 5, food_id: 42, qty_g: 100 })];
    const r = refeicaoResolvida(itens, [], 1);
    expect(r.lancaveis).toHaveLength(1);
    expect(r.naoContadas).toEqual([]);
  });
});

describe("kcalDaRefeicao com a refeição substituída", () => {
  it("soma só a lista nova, sem as linhas do plano", () => {
    const itens = [item({ id: 5 }), item({ id: 6 })];
    const t = [trocaRef({ id: 1, kcal: 480 }), trocaRef({ id: 2, kcal: 140 })];
    expect(kcalDaRefeicao(itens, t, new Map([[5, 300]]), 1)).toEqual({
      total: 620,
      incompleto: false,
    });
  });

  it("um alimento sem caloria deixa a soma incompleta", () => {
    const itens = [item({ id: 5 })];
    const t = [trocaRef({ id: 1, kcal: 480 }), trocaRef({ id: 2, kcal: null })];
    expect(kcalDaRefeicao(itens, t, new Map(), 1)).toEqual({ total: 480, incompleto: true });
  });
});
```

Acrescentar `trocasDaRefeicao` e `refeicaoSubstituida` ao `import` do topo do arquivo, e trocar `TrocaDeItem` por `Troca` no `import type`.

Nos testes que já existem, `refeicaoResolvida(...)` e `kcalDaRefeicao(...)` passam a receber o `blockId` `1` como último argumento (a fábrica `item` usa `block_id: 1`):

```bash
sed -i 's/refeicaoResolvida(\(itens\|\[[^]]*\]\), \([^)]*\))/refeicaoResolvida(\1, \2, 1)/g' src/domain/plano-dia.test.ts
```

Se o `sed` não pegar alguma chamada, ajustar à mão — o `type-check` aponta cada uma.

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm vitest run src/domain/plano-dia.test.ts`
Expected: FAIL — `trocasDaRefeicao is not a function`, `refeicaoSubstituida is not a function`, e as chamadas com quatro argumentos.

- [ ] **Step 4: Implementar no domínio**

Em `src/domain/plano-dia.ts`, depois de `itemDispensado`:

```ts
/**
 * Os alimentos que substituíram a REFEIÇÃO inteira, na ordem em que entraram.
 *
 * `item_id` nulo é o que diz o escopo: a troca não está no lugar de uma linha,
 * está no lugar do bloco. É o caso de quem comeu uma pizza no lugar de um
 * almoço de quatro linhas — a lista nova não tem por que ter o tamanho do que
 * o nutricionista escreveu.
 */
export function trocasDaRefeicao(trocas: Troca[], blockId: number): Troca[] {
  return trocas.filter((t) => t.block_id === blockId && t.item_id === null && !t.dispensado);
}

/** A refeição foi substituída inteira? */
export function refeicaoSubstituida(trocas: Troca[], blockId: number): boolean {
  return trocasDaRefeicao(trocas, blockId).length > 0;
}
```

`refeicaoResolvida` ganha o curto-circuito no topo e o campo `naoContadas`:

```ts
export function refeicaoResolvida(
  itens: PlanItem[],
  trocas: Troca[],
  blockId: number,
): {
  lancaveis: LancamentoDoPlano[];
  semAlimento: PlanItem[];
  dispensados: PlanItem[];
  naoContadas: Troca[];
} {
  // A refeição foi substituída inteira: as linhas do plano não são mais o que
  // se comeu, então nenhuma delas entra — nem como lançável, nem como aviso.
  // Quem responde pelo dia é a lista nova.
  const daRefeicao = trocasDaRefeicao(trocas, blockId);
  if (daRefeicao.length > 0) {
    const lancaveis: LancamentoDoPlano[] = [];
    const naoContadas: Troca[] = [];
    for (const t of daRefeicao) {
      if (t.food_id === null || t.qty_g === null || t.qty_g <= 0) {
        naoContadas.push(t);
        continue;
      }
      lancaveis.push({
        item_id: null, food_id: t.food_id, qty_g: t.qty_g,
        measure_id: t.measure_id, medidas: t.medidas, label: t.nome,
      });
    }
    return { lancaveis, semAlimento: [], dispensados: [], naoContadas };
  }

  const lancaveis: LancamentoDoPlano[] = [];
  /* …o corpo que já existe, inalterado… */
  return { lancaveis, semAlimento, dispensados, naoContadas: [] };
}
```

`kcalDaRefeicao` ganha `blockId` e o mesmo curto-circuito:

```ts
export function kcalDaRefeicao(
  itens: PlanItem[],
  trocas: Troca[],
  kcalPorItem: Map<number, number>,
  blockId: number,
): { total: number; incompleto: boolean } {
  const daRefeicao = trocasDaRefeicao(trocas, blockId);
  if (daRefeicao.length > 0) {
    let total = 0;
    let incompleto = false;
    for (const t of daRefeicao) {
      if (t.kcal === null) incompleto = true;
      else total += t.kcal;
    }
    return { total: Math.round(total), incompleto };
  }

  /* …o corpo que já existe, inalterado… */
}
```

- [ ] **Step 5: Ajustar os três chamadores**

`src/repositories/plano.ts:693` — passar o `blockId` que a função já tem em mãos:

```ts
  const { lancaveis } = refeicaoResolvida(itens, await listTrocasDoDia(db, userId, data), blockId);
```

`src/components/plano/sheet-trocas.tsx:468` e `src/components/plano/bloco-card.tsx:78` — passar `bloco.id`.

- [ ] **Step 6: Rodar tudo**

Run: `pnpm vitest run && pnpm type-check`
Expected: PASS nos dois.

- [ ] **Step 7: Commit**

```bash
git add src api
git commit -m "feat(plano): o domínio distingue a troca da linha da troca da refeição"
```

---

## Task 3: O repositório grava e limpa a refeição

**Files:**
- Modify: `src/repositories/plano.ts:425-437` (`TrocaEntrada`), e depois de `salvarTroca` (`:477-503`)
- Modify: `api/_lib/registro.ts:99-120`
- Modify: `src/hooks/use-plano.ts:181-212`
- Test: `src/repositories/plano.test.ts`

**Interfaces:**
- Consumes: `Troca`, `trocasDaRefeicao` (Task 2); esquema da Task 1.
- Produces:
  - `TrocaEntrada.item_id: number | null`
  - `adicionarTrocaDaRefeicao(db: Client, userId: number, e: TrocaEntrada): Promise<void>`
  - `limparRefeicao(db: Client, userId: number, data: string, blockId: number): Promise<void>`
  - hooks `useAdicionarTrocaDaRefeicao(data)` (muta com `TrocaEntrada`) e `useLimparRefeicao(data)` (muta com `blockId: number`)

- [ ] **Step 1: Escrever os testes que falham**

Em `src/repositories/plano.test.ts`, acrescentar ao fim (usar os helpers e o `beforeEach` que o arquivo já tem; se os ids de bloco/item diferirem dos daqui, ajustar para os que o arquivo cria):

```ts
describe("troca da refeição inteira", () => {
  it("acrescenta alimentos sem se pendurar em linha nenhuma", async () => {
    await adicionarTrocaDaRefeicao(db, 1, {
      data: "2026-09-09", block_id: BLOCO_ID, item_id: null,
      food_id: 1, qty_g: 300, kcal: 480,
    });
    await adicionarTrocaDaRefeicao(db, 1, {
      data: "2026-09-09", block_id: BLOCO_ID, item_id: null,
      texto: "Sorvete da esquina", kcal: null,
    });

    const trocas = await listTrocasDoDia(db, 1, "2026-09-09");
    expect(trocasDaRefeicao(trocas, BLOCO_ID).map((t) => t.nome)).toEqual([
      "Tapioca goma",
      "Sorvete da esquina",
    ]);
  });

  it("substituir a refeição apaga as trocas de linha do bloco", async () => {
    // Uma refeição está num modo ou no outro: ou você ajusta linha a linha,
    // ou você a substituiu inteira.
    await adicionarTroca(db, 1, {
      data: "2026-09-09", block_id: BLOCO_ID, item_id: ITEM_ID, food_id: 1, qty_g: 50, kcal: 120,
    });
    await dispensarItem(db, 1, "2026-09-09", BLOCO_ID, ITEM_ID_2);

    await adicionarTrocaDaRefeicao(db, 1, {
      data: "2026-09-09", block_id: BLOCO_ID, item_id: null, food_id: 1, qty_g: 300, kcal: 480,
    });

    const trocas = await listTrocasDoDia(db, 1, "2026-09-09");
    expect(trocas.filter((t) => t.item_id !== null)).toEqual([]);
    expect(trocasDaRefeicao(trocas, BLOCO_ID)).toHaveLength(1);
  });

  it("limparRefeicao devolve o bloco ao plano, nos dois escopos", async () => {
    await adicionarTroca(db, 1, {
      data: "2026-09-09", block_id: BLOCO_ID, item_id: ITEM_ID, food_id: 1, qty_g: 50, kcal: 120,
    });
    await adicionarTrocaDaRefeicao(db, 1, {
      data: "2026-09-09", block_id: BLOCO_ID, item_id: null, food_id: 1, qty_g: 300, kcal: 480,
    });

    await limparRefeicao(db, 1, "2026-09-09", BLOCO_ID);

    expect(await listTrocasDoDia(db, 1, "2026-09-09")).toEqual([]);
  });

  it("marcar 'Comi' lança a lista nova, e nenhuma linha do plano", async () => {
    await adicionarTrocaDaRefeicao(db, 1, {
      data: "2026-09-09", block_id: BLOCO_ID, item_id: null, food_id: 1, qty_g: 300, kcal: 480,
    });
    await marcarBloco(db, 1, PLANO_ID, "2026-09-09", BLOCO_ID, true);

    const rs = await db.execute({
      sql: "SELECT label, qty_g FROM food_entries WHERE user_id=1 AND data=? AND plan_block_id=?",
      args: ["2026-09-09", BLOCO_ID],
    });
    expect(rs.rows.map((r) => r.label)).toEqual(["Tapioca goma"]);
    expect(Number(rs.rows[0].qty_g)).toBe(300);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/repositories/plano.test.ts`
Expected: FAIL — `adicionarTrocaDaRefeicao is not a function`.

- [ ] **Step 3: Implementar no repositório**

Em `src/repositories/plano.ts`, `TrocaEntrada.item_id`:

```ts
export interface TrocaEntrada {
  data: string;
  block_id: number;
  /** `null` = a troca é da REFEIÇÃO inteira, não de uma linha. */
  item_id: number | null;
```

E, depois de `salvarTroca`:

```ts
/**
 * Acrescenta um alimento à lista que substitui a REFEIÇÃO inteira.
 *
 * O `DELETE` é a regra do escopo escrita uma vez só: uma refeição está num
 * modo ou no outro — ou você ajusta linha a linha, ou você a substituiu. Somar
 * os dois seria "substituir tudo" que na verdade acrescenta.
 *
 * O caminho inverso não existe de propósito. Gravar uma troca de LINHA não
 * apaga a lista da refeição, porque a folha não deixa tocar numa linha
 * enquanto ela está substituída — você volta ao plano primeiro. Fazer o
 * `DELETE` simétrico transformaria um toque errado numa linha em perder uma
 * lista de cinco alimentos, sem aviso.
 */
export async function adicionarTrocaDaRefeicao(
  db: Client,
  userId: number,
  e: TrocaEntrada,
): Promise<void> {
  await db.batch([
    {
      sql: `DELETE FROM plan_item_swaps
            WHERE user_id=? AND data=? AND block_id=? AND item_id IS NOT NULL`,
      args: [userId, e.data, e.block_id] as (number | string | null)[],
    },
    {
      sql: `INSERT INTO plan_item_swaps
              (user_id, data, block_id, item_id, swap_id, food_id, texto,
               qty_g, measure_id, medidas, kcal, dispensado, created_at)
            VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      args: [
        userId, e.data, e.block_id,
        e.swap_id ?? null, e.food_id ?? null, e.texto ?? null,
        e.qty_g ?? null, e.measure_id ?? null, e.medidas ?? null, e.kcal ?? null,
        new Date().toISOString(),
      ] as (number | string | null)[],
    },
  ], "write");
}

/**
 * "Voltar ao plano": apaga os DOIS escopos do bloco naquele dia.
 *
 * É a única saída de uma refeição substituída, e por isso não pode deixar
 * resto: uma troca de linha sobrevivente reapareceria sozinha quando a lista
 * nova sumisse.
 */
export async function limparRefeicao(
  db: Client,
  userId: number,
  data: string,
  blockId: number,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM plan_item_swaps WHERE user_id=? AND data=? AND block_id=?",
    args: [userId, data, blockId],
  });
}
```

- [ ] **Step 4: Registrar as duas operações**

Em `api/_lib/registro.ts`, na seção `/* ── plano ── */`, em ordem alfabética:

```ts
  "plano.adicionarTrocaDaRefeicao": { escopo: "usuario", fn: plano.adicionarTrocaDaRefeicao },
```
```ts
  "plano.limparRefeicao": { escopo: "usuario", fn: plano.limparRefeicao },
```

- [ ] **Step 5: Os dois hooks**

Em `src/hooks/use-plano.ts`, depois de `useSalvarTroca`:

```ts
/** Acrescenta um alimento à lista que substitui a refeição inteira. */
export function useAdicionarTrocaDaRefeicao(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (e: TrocaEntrada) =>
    api["plano"].adicionarTrocaDaRefeicao(e),
  );
}

/** "Voltar ao plano": apaga as trocas dos dois escopos do bloco. */
export function useLimparRefeicao(data: string) {
  const api = useApi();
  return useEscritaDeTroca(data, (blockId: number) =>
    api["plano"].limparRefeicao(data, blockId),
  );
}
```

- [ ] **Step 6: Rodar**

Run: `pnpm vitest run src/repositories/plano.test.ts api/_lib/api-escopo.test.ts && pnpm type-check`
Expected: PASS — inclusive o `api-escopo`, que falha se uma operação nova ficar fora do `REGISTRO`.

- [ ] **Step 7: Commit**

```bash
git add src api
git commit -m "feat(plano): gravar e limpar a lista que substitui a refeição"
```

---

## Task 4: O formulário das três abas vira um componente

Refatoração pura: nenhum teste muda, nenhum comportamento muda. Ela existe porque o nível 3 precisa do mesmo formulário, e duplicá-lo duplicaria também a limpeza depois de cada alimento — o conserto de `84945ef`, que é o que faz "adicionar outro" funcionar.

**Files:**
- Create: `src/components/plano/escolher-alimento.tsx`
- Create: `src/components/plano/trocar-item.tsx`
- Modify: `src/components/plano/sheet-trocas.tsx` (fica só com o nível 1)

**Interfaces:**
- Consumes: `Troca`, `trocasPara`, `trocasDoBloco` (Task 2).
- Produces:
  - `type Aba = "plano" | "catalogo" | "texto"` (exportado de `escolher-alimento.tsx`)
  - `interface GrupoDoPlano { categoria: string | null; opcoes: PlanSwap[] }`
  - `EscolherAlimento({ aba, onAba, grupos, acrescenta, swapAtivo, onConfirmar })`
  - `TrocarItem({ …as props de hoje… })`, exportado de `trocar-item.tsx`

- [ ] **Step 1: Guardar o verde de partida**

Run: `pnpm vitest run src/components/plano`
Expected: PASS. Anotar quantos testes passaram — o mesmo número tem que passar no fim da task.

- [ ] **Step 2: Criar `escolher-alimento.tsx`**

Recortar de `sheet-trocas.tsx` os estados `termo`/`alimento`/`qtd`/`medidaId`/`texto`/`kcalTexto`, o `tocouNaQtd`, o `useEffect` da sugestão de porção, a função `confirmar`, o `Segmented` e os três blocos de aba — sem alterar uma linha de lógica. O componente novo:

```tsx
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { useFoods } from "@/hooks/use-foods";
import { useMeasures } from "@/hooks/use-food-measures";
import { macrosDoEntry } from "@/domain/nutrition";
import { sugerirPorcao } from "@/domain/medida-default";
import { formatarNumero, resolverQtdBase } from "@/domain/medidas";
import type { PlanSwap } from "@/domain/plano-types";
import type { Food } from "@/domain/types";
import type { TrocaEntrada } from "@/repositories/plano";

const BASE = "__base__"; // o <option> "na unidade base", como no diário

export type Aba = "plano" | "catalogo" | "texto";

const ABAS = [
  { valor: "plano" as const, label: "Do plano" },
  { valor: "catalogo" as const, label: "Catálogo" },
  { valor: "texto" as const, label: "Escrever" },
];

/**
 * As opções previstas, agrupadas.
 *
 * `categoria: null` desenha uma lista sem título — é o que o nível da LINHA
 * quer, porque ali as opções já vêm filtradas pela categoria dela. O nível da
 * refeição passa N grupos, com título, porque não há categoria para filtrar.
 */
export interface GrupoDoPlano {
  categoria: string | null;
  opcoes: PlanSwap[];
}

export type Escolha = Omit<TrocaEntrada, "data" | "block_id" | "item_id">;

/**
 * As três origens de uma troca, num formulário só.
 *
 * "Do plano" é o caminho curto e o que o nutricionista autorizou, então abre
 * primeiro. Os outros dois existem porque a vida acontece: sem eles, o dia em
 * que você come outra coisa é um dia que o app perde inteiro.
 *
 * O formulário nasce VAZIO e volta a ficar vazio depois de cada alimento: a
 * lista de resultados só aparece quando NÃO há alimento selecionado, então um
 * campo preenchido tornaria o segundo alimento inalcançável.
 */
export function EscolherAlimento({
  aba,
  onAba,
  grupos,
  acrescenta,
  swapAtivo,
  onConfirmar,
}: {
  aba: Aba;
  onAba: (a: Aba) => void;
  grupos: GrupoDoPlano[];
  /** O toque acrescenta a uma lista que já tem alguma coisa? Muda o verbo. */
  acrescenta: boolean;
  /** `plan_swaps.id` já escolhido, para o `aria-pressed`. */
  swapAtivo: number | null;
  onConfirmar: (e: Escolha) => void;
}) {
  /* …os estados, o ref, o efeito e as três abas, recortados sem mudança… */
}
```

Três detalhes do recorte:

1. O verbo do catálogo passa a sair de `acrescenta`: `` `${acrescenta ? "Adicionar" : "Trocar por"} ${alimento.nome}` ``. O da aba "Escrever" idem: `acrescenta ? "Adicionar" : "Trocar"`. É exatamente o que `escolhidas.length > 0` decidia antes.
2. A ordenação por caloria vai para dentro do componente, uma vez por grupo: `[...g.opcoes].sort((a, b) => a.kcal - b.kcal)`.
3. Um grupo com `categoria` não nula ganha um título antes da lista:

```tsx
{g.categoria && (
  <p className="t-caption mt-3 first:mt-0">{ROTULO[g.categoria] ?? g.categoria}</p>
)}
```

O mapa `ROTULO` (hoje no topo de `sheet-trocas.tsx`) passa a viver aqui e é reexportado, porque os três arquivos o usam.

O vazio some quando não há nenhum grupo com opções:

```tsx
{grupos.every((g) => g.opcoes.length === 0) && (
  <p className="t-caption py-6 text-center">
    Seu plano não lista substituição aqui. Use o catálogo ou escreva o que você comeu.
  </p>
)}
```

- [ ] **Step 3: Criar `trocar-item.tsx`**

Mover para lá o `TrocarItem` inteiro (`sheet-trocas.tsx:60-410`), trocando o miolo do formulário pelo componente novo:

```tsx
<EscolherAlimento
  aba={aba}
  onAba={(a) => { setAba(a); onAba(a); }}
  grupos={[{ categoria: null, opcoes: doPlano }]}
  acrescenta={escolhidas.length > 0}
  swapAtivo={trocaAtual?.swap_id ?? null}
  onConfirmar={onEscolher}
/>
```

`doPlano` continua calculado como hoje. A lista de escolhidas com o `×`, o "Não comi esta linha" e o "Próximo item" ficam em `TrocarItem` — são do escopo da linha.

- [ ] **Step 4: `sheet-trocas.tsx` importa em vez de definir**

```tsx
import { TrocarItem } from "./trocar-item";
import type { Aba } from "./escolher-alimento";
```

Nenhuma outra mudança nesta task.

- [ ] **Step 5: Rodar e comparar com o verde de partida**

Run: `pnpm vitest run src/components/plano && pnpm type-check`
Expected: PASS, com o MESMO número de testes do Step 1. Refatoração que muda a contagem mudou comportamento.

- [ ] **Step 6: Commit**

```bash
git add src/components/plano
git commit -m "refactor(plano): o formulário das três abas vira um componente só"
```

---

## Task 5: O nível 3 — trocar a refeição

**Files:**
- Create: `src/components/plano/trocar-refeicao.tsx`
- Modify: `src/components/plano/sheet-trocas.tsx` (rodapé de dois botões, estado do nível 3, props novas)
- Modify: `src/pages/dashboard.tsx:338-357`
- Test: `src/components/plano/sheet-trocas.test.tsx`

**Interfaces:**
- Consumes: `EscolherAlimento`, `GrupoDoPlano`, `Escolha`, `Aba` (Task 4); `trocasDaRefeicao`, `kcalDaRefeicao` (Task 2); `useAdicionarTrocaDaRefeicao`, `useLimparRefeicao` (Task 3).
- Produces:
  - `TrocarRefeicao({ bloco, swaps, escolhidas, aba, onAba, onEscolher, onRemoverUma, onVoltar, onVoltarAoPlano })`
  - `SheetTrocas` ganha `onTrocarRefeicao: (e: Escolha) => void` e `onDesfazerRefeicao: () => void`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/components/plano/sheet-trocas.test.tsx`: acrescentar `onTrocarRefeicao` e `onDesfazerRefeicao` ao `montar` (mocks e props, junto dos outros), a fábrica `trocaRef`, e trocar os `getByRole("button", { name: /trocar tudo/i })` por `/linha a linha/i` nas linhas 157, 280, 304, 306, 337, 362 e 516.

```tsx
/** Uma troca da REFEIÇÃO inteira — o `item_id` nulo é o que diz isso. */
const trocaRef = (p: Partial<Troca> & { id: number }): Troca => ({
  data: "2026-08-31", block_id: 10, item_id: null, origem: "catalogo", swap_id: null,
  nome: "Pizza", porcao: null, kcal: null,
  food_id: null, qty_g: null, measure_id: null, medidas: null, dispensado: false, ...p,
});
```

```tsx
describe("SheetTrocas — trocar a refeição inteira", () => {
  it("o rodapé oferece os dois caminhos", () => {
    montar();
    expect(screen.getByRole("button", { name: /linha a linha/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refeição inteira/i })).toBeInTheDocument();
  });

  it("'Refeição inteira' abre a lista livre, não a primeira linha", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /refeição inteira/i }));

    expect(screen.getByText(/monte o que você comeu/i)).toBeInTheDocument();
    // Nada de "Item 1 de 3": não se está percorrendo coisa nenhuma.
    expect(screen.queryByText(/item 1 de 3/i)).toBeNull();
  });

  it("dois alimentos do plano ACUMULAM, em vez de um corrigir o outro", async () => {
    // É a diferença que justifica o nível: na linha, escolher de novo corrige;
    // na refeição, escolher de novo acrescenta.
    const user = userEvent.setup();
    const { onTrocarRefeicao } = montar();
    await user.click(screen.getByRole("button", { name: /refeição inteira/i }));

    await user.click(screen.getByRole("button", { name: /ovos inteiros/i }));
    await user.click(screen.getByRole("button", { name: /tapioca/i }));

    expect(onTrocarRefeicao).toHaveBeenCalledTimes(2);
    expect(onTrocarRefeicao.mock.calls[0][0]).toEqual({ swap_id: 1 });
    expect(onTrocarRefeicao.mock.calls[1][0]).toEqual({ swap_id: 3 });
  });

  it("mostra as substituições de TODAS as categorias do bloco", async () => {
    // Não há categoria de linha para filtrar: a lista é do bloco inteiro.
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /refeição inteira/i }));

    expect(screen.getByRole("button", { name: /ovos inteiros/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aveia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /banana/i })).toBeInTheDocument();
    // A da Janta não é deste bloco.
    expect(screen.queryByRole("button", { name: /peixe branco/i })).toBeNull();
  });

  it("soma a caloria da lista contra a meta do bloco", async () => {
    const user = userEvent.setup();
    montar({ trocas: [trocaRef({ id: 1, nome: "Pizza", kcal: 480 })] });
    await user.click(screen.getByRole("button", { name: /adicionar alimento/i }));

    expect(screen.getByText(/480 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/~400/)).toBeInTheDocument();
  });

  it("um alimento sem caloria marca a soma com '+'", async () => {
    const user = userEvent.setup();
    montar({
      trocas: [
        trocaRef({ id: 1, nome: "Pizza", kcal: 480 }),
        trocaRef({ id: 2, nome: "Sorvete da esquina", kcal: null }),
      ],
    });
    await user.click(screen.getByRole("button", { name: /adicionar alimento/i }));

    expect(screen.getByText(/480\+/)).toBeInTheDocument();
  });

  it("cada alimento da lista pode sair sozinho", async () => {
    const user = userEvent.setup();
    const { onRemoverUma } = montar({
      trocas: [trocaRef({ id: 7, nome: "Pizza", kcal: 480 })],
    });
    await user.click(screen.getByRole("button", { name: /adicionar alimento/i }));
    await user.click(screen.getByRole("button", { name: /remover pizza/i }));

    expect(onRemoverUma).toHaveBeenCalledWith(7);
  });

  it("'Voltar ao plano' desfaz a refeição inteira", async () => {
    const user = userEvent.setup();
    const { onDesfazerRefeicao } = montar({
      trocas: [trocaRef({ id: 1, nome: "Pizza", kcal: 480 })],
    });
    await user.click(screen.getByRole("button", { name: /voltar ao plano/i }));

    expect(onDesfazerRefeicao).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/components/plano/sheet-trocas.test.tsx`
Expected: FAIL — `Unable to find role="button" and name /refeição inteira/i`.

- [ ] **Step 3: Criar `trocar-refeicao.tsx`**

```tsx
import { ChevronLeft, X } from "lucide-react";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { descreverTroca, kcalDaRefeicao, trocasDoBloco } from "@/domain/plano-dia";
import type { PlanBlock, PlanSwap, Troca } from "@/domain/plano-types";
import { EscolherAlimento } from "./escolher-alimento";
import type { Aba, Escolha } from "./escolher-alimento";

/**
 * NÍVEL 3 — a refeição inteira, trocada por uma lista nova.
 *
 * A diferença que justifica o nível: aqui TODO confirmar acrescenta, inclusive
 * na aba "Do plano". No nível da linha, escolher uma segunda opção prevista é
 * corrigir a primeira — duas substituições para a mesma linha não é o que
 * aquele toque quer dizer. No nível da refeição, escolher duas é exatamente o
 * que este quer.
 */
export function TrocarRefeicao({
  bloco,
  swaps,
  escolhidas,
  aba,
  onAba,
  onEscolher,
  onRemoverUma,
  onVoltar,
  onVoltarAoPlano,
}: {
  bloco: PlanBlock;
  swaps: PlanSwap[];
  /** A lista que já substitui a refeição, na ordem em que foi montada. */
  escolhidas: Troca[];
  aba: Aba;
  onAba: (a: Aba) => void;
  onEscolher: (e: Escolha) => void;
  onRemoverUma: (trocaId: number) => void;
  onVoltar: () => void;
  onVoltarAoPlano: () => void;
}) {
  // Sem categoria de linha para filtrar, a lista é a do bloco inteiro, com
  // título por categoria.
  const grupos = [...trocasDoBloco(swaps, bloco.nome)].map(([categoria, opcoes]) => ({
    categoria,
    opcoes,
  }));

  // `[]` de itens não é descuido: com a refeição substituída, as linhas do
  // plano não entram na conta, e `kcalDaRefeicao` já sabe disso. A guarda do
  // `length` é o que impede a função de cair no ramo das linhas quando ainda
  // não há nada escolhido.
  const soma = escolhidas.length > 0
    ? kcalDaRefeicao([], escolhidas, new Map(), bloco.id)
    : null;

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onVoltar}
            aria-label="Voltar para a refeição"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate">Trocar {bloco.nome}</SheetTitle>
            <SheetDescription>Monte o que você comeu</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {escolhidas.length > 0 && (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {escolhidas.map((t) => (
                <li key={t.id} className="flex items-center gap-1 pr-2">
                  <span className="min-w-0 flex-1 truncate py-2.5 pl-4 text-sm">
                    {descreverTroca(t)}
                  </span>
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
            {soma && (
              <p className="t-caption tabular-nums">
                {soma.total}
                {soma.incompleto ? "+" : ""} kcal
                {bloco.kcal_alvo != null && ` · meta ~${bloco.kcal_alvo}`}
              </p>
            )}
          </>
        )}

        <EscolherAlimento
          aba={aba}
          onAba={onAba}
          grupos={grupos}
          acrescenta={escolhidas.length > 0}
          /* Nenhuma opção fica "pressionada": aqui a mesma pode entrar duas
             vezes, e marcá-la sugeriria que o segundo toque desfaz o primeiro. */
          swapAtivo={null}
          onConfirmar={onEscolher}
        />

        {escolhidas.length > 0 && (
          <div className="border-t border-border pt-3">
            <Button variant="outline" block onClick={onVoltarAoPlano}>
              Voltar ao plano
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Ligar o nível 3 na folha**

Em `sheet-trocas.tsx`: duas props novas, um estado, e o rodapé.

```tsx
  /** Acrescenta um alimento à lista que substitui a refeição inteira. */
  onTrocarRefeicao: (e: Escolha) => void;
  /** "Voltar ao plano": apaga os dois escopos do bloco. */
  onDesfazerRefeicao: () => void;
```

```tsx
  /** O nível 3 está aberto? */
  const [refeicaoAberta, setRefeicaoAberta] = useState(false);
  const daRefeicao = trocasDaRefeicao(trocas, bloco.id);
  const substituida = daRefeicao.length > 0;
```

O `SheetContent` passa a escolher entre três, na ordem em que se sai deles:

```tsx
{aberto ? (
  <TrocarItem … />
) : refeicaoAberta ? (
  <TrocarRefeicao
    bloco={bloco}
    swaps={swaps}
    escolhidas={daRefeicao}
    aba={abaPreferida}
    onAba={setAbaPreferida}
    onEscolher={onTrocarRefeicao}
    onRemoverUma={onRemoverUma}
    onVoltar={() => setRefeicaoAberta(false)}
    onVoltarAoPlano={() => { onDesfazerRefeicao(); setRefeicaoAberta(false); }}
  />
) : (
  /* …o nível 1… */
)}
```

E o rodapé do nível 1:

```tsx
<div className="space-y-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
  {itens.length > 0 && (
    <div className="flex gap-2">
      {substituida ? (
        <>
          <Button variant="outline" className="flex-1" onClick={onDesfazerRefeicao}>
            Voltar ao plano
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setRefeicaoAberta(true)}>
            Adicionar alimento
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { setPercorrendo(0); setAbertoId(itens[0].id); }}
          >
            <Repeat className="size-4" />
            Linha a linha
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setRefeicaoAberta(true)}>
            Refeição inteira
          </Button>
        </>
      )}
    </div>
  )}
  <Button block onClick={() => { onMarcar(!feito); onClose(); }}>
    {feito ? "Desmarcar" : "Comi"}
  </Button>
</div>
```

A `SheetDescription` do nível 1 passa a dizer os dois caminhos:

```tsx
<SheetDescription>
  Toque numa linha para trocar só ela, ou troque a refeição inteira por uma lista nova.
</SheetDescription>
```

- [ ] **Step 5: Fiar no dashboard**

Em `src/pages/dashboard.tsx`: importar e instanciar os dois hooks junto dos outros (`const trocarRefeicao = useAdicionarTrocaDaRefeicao(data);`, `const limparRefeicao = useLimparRefeicao(data);`) e passar:

```tsx
  onTrocarRefeicao={(e) =>
    trocarRefeicao.mutate({ data, block_id: trocando.id, item_id: null, ...e })
  }
  onDesfazerRefeicao={() => limparRefeicao.mutate(trocando.id)}
```

- [ ] **Step 6: Rodar**

Run: `pnpm vitest run src/components/plano && pnpm type-check`
Expected: PASS — os oito novos e todos os que já existiam.

- [ ] **Step 7: Commit**

```bash
git add src/components/plano src/pages/dashboard.tsx
git commit -m "feat(plano): trocar a refeição inteira por uma lista de quantos alimentos você quiser"
```

---

## Task 6: A refeição substituída na folha e no card

**Files:**
- Modify: `src/components/plano/sheet-trocas.tsx` (o corpo do nível 1)
- Modify: `src/components/plano/bloco-card.tsx:167-196`
- Test: `src/components/plano/sheet-trocas.test.tsx`, `src/components/plano/bloco-card.test.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 2 e 5.
- Produces: nenhuma assinatura nova — só desenho.

- [ ] **Step 1: Escrever os testes que falham**

Em `sheet-trocas.test.tsx`, dentro do `describe` da task anterior:

```tsx
  it("com a refeição substituída, as linhas ficam riscadas e a lista aparece", () => {
    montar({
      trocas: [
        trocaRef({ id: 1, nome: "Pizza", porcao: "3 fatias", kcal: 480 }),
        trocaRef({ id: 2, nome: "Refrigerante", porcao: "350 ml", kcal: 140 }),
      ],
    });

    expect(screen.getByText(/o plano previa/i)).toBeInTheDocument();
    expect(screen.getByText("3 ovos mexidos")).toHaveClass("line-through");
    expect(screen.getByText(/pizza · 3 fatias · 480 kcal/i)).toBeInTheDocument();
    expect(screen.getByText(/refrigerante · 350 ml · 140 kcal/i)).toBeInTheDocument();
  });

  it("com a refeição substituída, a linha deixa de ser um alvo de troca", () => {
    // Trocar uma linha aqui não quer dizer nada — e deixar tocável convidaria
    // a perder a lista sem aviso. A saída é "Voltar ao plano".
    montar({ trocas: [trocaRef({ id: 1, nome: "Pizza", kcal: 480 })] });

    expect(screen.queryByRole("button", { name: /trocar 3 ovos mexidos/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /linha a linha/i })).toBeNull();
  });

  it("avisa o alimento que não entra no balanço", () => {
    montar({ trocas: [trocaRef({ id: 1, nome: "Sorvete da esquina", kcal: null })] });
    expect(screen.getByText(/não entra no balanço/i)).toBeInTheDocument();
  });
```

Em `bloco-card.test.tsx` (a fábrica `troca` do arquivo, se não existir, segue o mesmo molde — `block_id: 1`, que é o id do bloco padrão dali):

```tsx
describe("BlocoCard — a refeição substituída", () => {
  const trocaRef = (p: Partial<Troca> & { id: number }): Troca => ({
    data: "2026-09-09", block_id: 1, item_id: null, origem: "catalogo", swap_id: null,
    nome: "Pizza", porcao: null, kcal: null,
    food_id: null, qty_g: null, measure_id: null, medidas: null, dispensado: false, ...p,
  });

  it("desenha a lista nova sobre as linhas riscadas", () => {
    montar("agora", {
      trocas: [
        trocaRef({ id: 1, nome: "Pizza", porcao: "3 fatias", kcal: 480 }),
        trocaRef({ id: 2, nome: "Refrigerante", kcal: 140 }),
      ],
    });

    expect(screen.getByText("120g de frango")).toHaveClass("line-through");
    expect(screen.getByText(/pizza · 3 fatias · 480 kcal/i)).toBeInTheDocument();
    expect(screen.getByText(/refrigerante · 140 kcal/i)).toBeInTheDocument();
  });

  it("a caloria do card é a da lista nova, não a do plano", () => {
    montar("agora", {
      trocas: [trocaRef({ id: 1, kcal: 480 }), trocaRef({ id: 2, kcal: 140 })],
      kcalPorItem: new Map([[1, 300], [2, 200]]),
    });
    expect(screen.getByText("620 / ~500 kcal")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/components/plano`
Expected: FAIL — `Unable to find an element with the text: /o plano previa/i`.

- [ ] **Step 3: O corpo do nível 1**

Em `sheet-trocas.tsx`, o `<div className="flex-1 overflow-y-auto px-4">` passa a escolher entre dois desenhos:

```tsx
{itens.length === 0 ? (
  <p className="t-caption py-6 text-center">Esta refeição não tem itens no seu plano.</p>
) : substituida ? (
  <div className="space-y-3">
    {/* O plano continua visível: a troca só faz sentido contra o que ela
        substituiu, e sumi-lo apagaria o que o nutricionista mandou. Riscado
        em bloco, porque foi a refeição que saiu, não cada linha. */}
    <div>
      <p className="t-caption">o plano previa</p>
      <ul className="mt-1 space-y-0.5">
        {itens.map((i) => (
          <li key={i.id} className="text-sm text-muted-foreground line-through">
            {i.texto}
          </li>
        ))}
      </ul>
    </div>
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {daRefeicao.map((t) => (
        <li key={t.id} className="flex items-center gap-1 pr-2">
          <span className="min-w-0 flex-1 py-2.5 pl-4">
            <span className="block truncate text-sm font-medium text-primary">
              {descreverTroca(t)}
            </span>
            {naoContadas.has(t.id) && (
              <span className="t-caption block">
                não entra no balanço — escolha pelo catálogo
              </span>
            )}
          </span>
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
  </div>
) : (
  /* …a lista de linhas que já existe… */
)}
```

E o cálculo dos avisos passa a cobrir os dois escopos:

```tsx
  const resolvida = refeicaoResolvida(itens, trocas, bloco.id);
  const foraDoBalanco = new Set(resolvida.semAlimento.map((i) => i.id));
  const naoContadas = new Set(resolvida.naoContadas.map((t) => t.id));
```

- [ ] **Step 4: O card**

Em `bloco-card.tsx`, a `<ul>` das linhas ganha o mesmo desvio:

```tsx
{aberto && !ehAgua && itens.length > 0 && (
  substituida ? (
    <div className="mt-3 space-y-2">
      <div>
        <p className="t-caption">o plano previa</p>
        <ul className="mt-1 space-y-0.5">
          {itens.map((i) => (
            <li key={i.id} className="text-sm text-muted-foreground line-through">
              {i.texto}
            </li>
          ))}
        </ul>
      </div>
      <ul className="space-y-1">
        {daRefeicao.map((t) => (
          <li key={t.id} className="flex gap-2 text-sm">
            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0 font-medium text-primary">{descreverTroca(t)}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : (
    /* …a <ul> que já existe… */
  )
)}
```

com, no topo do componente:

```tsx
  const daRefeicao = trocasDaRefeicao(trocas, bloco.id);
  const substituida = daRefeicao.length > 0;
```

`mexida` passa a incluir o escopo da refeição — sem isso o card mostraria `~500 kcal` sobre uma pizza:

```tsx
  const mexida = trocas.some((t) => t.block_id === bloco.id);
```

(já é assim; conferir que continua verdadeiro para `item_id` nulo, e que `kcalDaRefeicao` recebe `bloco.id`).

- [ ] **Step 5: Rodar**

Run: `pnpm vitest run src/components/plano && pnpm type-check`
Expected: PASS.

- [ ] **Step 6: Verificação final**

Run: `pnpm lint && pnpm format:check && pnpm type-check && pnpm test`
Expected: os quatro PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/plano
git commit -m "feat(plano): a folha e o card desenham a refeição substituída"
```

---

## Autorrevisão do plano

**Cobertura do spec.** §1 esquema → Task 1. §2 domínio (rename, duas funções, `refeicaoResolvida`, `kcalDaRefeicao`) → Task 2. §3 repositório (duas escritas, `REGISTRO`, ausência do `DELETE` simétrico) → Task 3. §4 telas: quebra do arquivo → Task 4; nível 3 e rodapé → Task 5; nível 1 substituído e card → Task 6. §5 testes → distribuídos nas seis. Sem lacuna.

**Consistência de tipos.** `Troca` (Task 2) é o tipo usado em `trocasDaRefeicao`, `TrocarRefeicao.escolhidas` e nas fábricas de teste. `Escolha = Omit<TrocaEntrada, "data" | "block_id" | "item_id">` nasce em Task 4 e é o que `onTrocarRefeicao` recebe em Task 5. `TrocaEntrada.item_id: number | null` (Task 3) é o que o dashboard preenche com `null` (Task 5). `kcalDaRefeicao` tem quatro parâmetros a partir da Task 2, e é chamada com quatro em `bloco-card.tsx` (Task 6) e em `trocar-refeicao.tsx` (Task 5).

**Risco vivo.** A Task 4 é refatoração sem teste próprio: a rede é a contagem de testes antes e depois. Se ela mudar, alguma coisa mudou de comportamento junto.
