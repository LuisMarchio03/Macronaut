# A sessão de treino como objeto vivo — plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** dar à sessão de treino um ciclo de vida explícito — rascunho → em
andamento → concluído — para que ela só entre no histórico quando terminar,
sobreviva à virada do dia, e fique visível enquanto acontece.

**Arquitetura:** uma coluna nova (`workout_sessions.iniciado_em`) mais a
`concluida_em` que já existe codificam os três estados; um predicado puro no
domínio é a única leitura dessa regra. As transições viram funções do
repositório `sessao.ts`, as leituras de histórico passam a exigir conclusão, e
duas superfícies novas de UI — a faixa fixa acima do `BottomNav` e a lista de
treinos abertos no hub — dão ao treino em curso um lugar.

**Stack:** React 19 + TypeScript, TanStack Query, react-router-dom 7,
Tailwind 4, libSQL (`@libsql/client`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-sessao-ativa-design.md`

## Restrições globais

- **Português em tudo que o usuário lê e em tudo que o programador lê:**
  nomes de função, variáveis, comentários, mensagens de commit e textos de
  interface. É a convenção da base inteira.
- **Comentário explica *por quê*, nunca *o quê*.** A base documenta decisões e
  armadilhas, não a sintaxe. Comentário que narra a linha seguinte é ruído.
- **Toda função de repositório recebe `(db: Client, userId: number, ...)`** e
  filtra por `user_id` em toda consulta. É o contrato do `REGISTRO` com escopo
  `usuario`, e a regressão de segurança que o commit `823e0e6` corrigiu.
- **Nada de SQL no cliente.** Telas e hooks falam por `api["modulo"].funcao()`;
  função nova só existe para o cliente depois de entrar em
  `api/_lib/registro.ts`. Os testes de componente passam pelo MESMO registro
  (`test/helpers/api-local.ts`), então esquecer o registro quebra o teste.
- **Rodar os testes:** `npm test` (tudo) ou
  `npx vitest run <caminho> -t "<nome>"` (um). Type-check: `npm run build`.
- **Commit por tarefa**, em português, no imperativo do que a mudança faz.

---

## Estrutura de arquivos

**Criar**

| Arquivo | Responsabilidade |
| --- | --- |
| `src/domain/sessao-estado.ts` | O predicado puro `estadoDaSessao`. Única leitura da regra dos três estados. |
| `src/domain/sessao-estado.test.ts` | Os quatro cruzamentos. |
| `src/hooks/use-tempo-decorrido.ts` | `agora − início`, ticando de segundo em segundo. |
| `src/hooks/use-tempo-decorrido.test.tsx` | Formatação e o tique. |
| `src/components/faixa-treino-ativo.tsx` | A faixa fixa acima do `BottomNav`. |
| `src/components/faixa-treino-ativo.test.tsx` | Aparece, some, ignora rascunho, conta o `+1`. |

**Modificar**

| Arquivo | Mudança |
| --- | --- |
| `src/db/schema.sql` | `iniciado_em TEXT` na definição de `workout_sessions`. |
| `scripts/lib/apply-schema.ts` | A coluna aditiva + o backfill que a acompanha. |
| `src/domain/types.ts` | `WorkoutSession` ganha `iniciado_em` e `concluida_em`. |
| `src/repositories/workouts.ts` | `mapSession` expõe os dois campos; `listSessions` e `listSessionsByRange` exigem conclusão. |
| `src/repositories/sessao.ts` | `criarSessao`, `iniciarSessao(id)`, `finalizarSessao` íntegra, auto-início, `sessoesAbertas`, `sessaoAtiva`. |
| `src/repositories/progresso.ts` | `sessoesComResumo` exige conclusão. |
| `api/_lib/registro.ts` | As operações novas entram, as antigas saem. |
| `src/hooks/use-sessao.ts` | Hooks das transições e da leitura nova. |
| `src/pages/treino-sessao.tsx` | Rodapé por estado; tempo decorrido no cabeçalho. |
| `src/pages/treino.tsx` | A lista de treinos abertos; a entrada cria rascunho. |
| `src/pages/treino-sessao-detalhe.tsx` | A sessão vem por id, não por `find` no histórico. |
| `src/pages/dashboard.tsx` | Consome `sessaoAtiva`. |
| `src/components/treino/sheet-treino-avulso.tsx` | "Começar" vira "Criar". |
| `src/App.tsx` | Monta a faixa; o padding inferior a acomoda. |

---

## Task 1: O predicado de estado

**Arquivos**
- Criar: `src/domain/sessao-estado.ts`
- Teste: `src/domain/sessao-estado.test.ts`

**Interfaces**
- Consome: nada.
- Produz: `type EstadoSessao = "rascunho" | "andamento" | "concluida"` e
  `estadoDaSessao(s: { iniciado_em: string | null; concluida_em: string | null }): EstadoSessao`.
  Toda tarefa seguinte importa daqui em vez de comparar `!= null` na mão.

- [ ] **Passo 1: escrever o teste que falha**

```ts
// src/domain/sessao-estado.test.ts
import { describe, it, expect } from "vitest";
import { estadoDaSessao } from "./sessao-estado";

describe("estadoDaSessao", () => {
  it("sem início e sem fim é rascunho", () => {
    expect(estadoDaSessao({ iniciado_em: null, concluida_em: null })).toBe("rascunho");
  });

  it("com início e sem fim está em andamento", () => {
    expect(
      estadoDaSessao({ iniciado_em: "2026-09-01T10:00:00.000Z", concluida_em: null }),
    ).toBe("andamento");
  });

  it("com os dois está concluída", () => {
    expect(
      estadoDaSessao({
        iniciado_em: "2026-09-01T10:00:00.000Z",
        concluida_em: "2026-09-01T11:00:00.000Z",
      }),
    ).toBe("concluida");
  });

  // O cruzamento que `finalizarSessao` torna impossível — mas uma linha vinda
  // de um banco mais velho que este código não pode derrubar a tela.
  it("concluída sem início é concluída, não rascunho", () => {
    expect(
      estadoDaSessao({ iniciado_em: null, concluida_em: "2026-09-01T11:00:00.000Z" }),
    ).toBe("concluida");
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/domain/sessao-estado.test.ts`
Esperado: FAIL — `Failed to resolve import "./sessao-estado"`.

- [ ] **Passo 3: implementar**

```ts
// src/domain/sessao-estado.ts

/**
 * Onde a sessão está no seu ciclo de vida.
 *
 * Dois campos do banco codificam três estados, e esta é a ÚNICA leitura deles
 * no app. Antes de existir, `concluida_em` era consultado em quatro arquivos
 * com três interpretações diferentes do que ele significava.
 */
export type EstadoSessao = "rascunho" | "andamento" | "concluida";

/**
 * `concluida_em` decide primeiro, de propósito.
 *
 * Uma sessão concluída sem `iniciado_em` é impossível daqui para frente —
 * `finalizarSessao` preenche os dois. Mas ela existe em qualquer banco que
 * rodou este app antes da coluna existir e não passou pelo backfill, e
 * classificá-la como rascunho a esconderia do histórico: o dado some da tela
 * por causa de uma coluna nula. Terminado é terminado.
 */
export function estadoDaSessao(s: {
  iniciado_em: string | null;
  concluida_em: string | null;
}): EstadoSessao {
  if (s.concluida_em !== null) return "concluida";
  return s.iniciado_em !== null ? "andamento" : "rascunho";
}
```

- [ ] **Passo 4: rodar e ver passar**

`npx vitest run src/domain/sessao-estado.test.ts` → 4 passando.

- [ ] **Passo 5: commitar**

```bash
git add src/domain/sessao-estado.ts src/domain/sessao-estado.test.ts
git commit -m "feat(treino): o estado da sessão vira um predicado do domínio"
```

---

## Task 2: A coluna `iniciado_em` e o backfill

**Arquivos**
- Modificar: `src/db/schema.sql` (bloco `workout_sessions`, ~linha 118)
- Modificar: `scripts/lib/apply-schema.ts` (`ADDITIVE_COLUMNS` e `applyAdditiveColumns`)
- Modificar: `src/domain/types.ts` (`WorkoutSession`, ~linha 134)
- Modificar: `src/repositories/workouts.ts` (`mapSession`, linhas 6–14)
- Teste: `scripts/lib/apply-schema.test.ts` (criar)

**Interfaces**
- Consome: nada.
- Produz: a coluna `workout_sessions.iniciado_em TEXT`; `WorkoutSession` com
  `iniciado_em: string | null` e `concluida_em: string | null`;
  `applyAdditiveColumns` idempotente com o backfill dentro.

- [ ] **Passo 1: escrever o teste que falha**

```ts
// scripts/lib/apply-schema.test.ts
import { describe, it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { applyAdditiveColumns } from "./apply-schema";

/** Um banco no formato ANTERIOR à coluna: é isso que existe em produção. */
async function bancoLegado() {
  const db = createClient({ url: ":memory:" });
  await db.execute(`CREATE TABLE workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    nome TEXT,
    created_at TEXT NOT NULL
  )`);
  return db;
}

describe("applyAdditiveColumns — iniciado_em", () => {
  it("marca toda sessão pré-existente como iniciada quando foi criada", async () => {
    const db = await bancoLegado();
    await db.execute({
      sql: "INSERT INTO workout_sessions (user_id, data, nome, created_at) VALUES (1,'2026-08-20','Peito',?)",
      args: ["2026-08-20T09:00:00.000Z"],
    });

    await applyAdditiveColumns(db);

    const rs = await db.execute("SELECT iniciado_em, created_at FROM workout_sessions");
    expect(rs.rows[0].iniciado_em).toBe("2026-08-20T09:00:00.000Z");
    expect(rs.rows[0].iniciado_em).toBe(rs.rows[0].created_at);
  });

  it("não reescreve o início de quem já tem um", async () => {
    const db = await bancoLegado();
    await db.execute("ALTER TABLE workout_sessions ADD COLUMN iniciado_em TEXT");
    await db.execute({
      sql: `INSERT INTO workout_sessions (user_id, data, nome, created_at, iniciado_em)
            VALUES (1,'2026-08-20','Peito',?,?)`,
      args: ["2026-08-20T09:00:00.000Z", "2026-08-20T18:30:00.000Z"],
    });

    await applyAdditiveColumns(db);

    const rs = await db.execute("SELECT iniciado_em FROM workout_sessions");
    expect(rs.rows[0].iniciado_em).toBe("2026-08-20T18:30:00.000Z");
  });

  it("rodar duas vezes não muda nada", async () => {
    const db = await bancoLegado();
    await db.execute({
      sql: "INSERT INTO workout_sessions (user_id, data, nome, created_at) VALUES (1,'2026-08-20','Peito',?)",
      args: ["2026-08-20T09:00:00.000Z"],
    });

    await applyAdditiveColumns(db);
    await applyAdditiveColumns(db);

    const rs = await db.execute("SELECT iniciado_em FROM workout_sessions");
    expect(rs.rows[0].iniciado_em).toBe("2026-08-20T09:00:00.000Z");
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run scripts/lib/apply-schema.test.ts`
Esperado: FAIL no primeiro caso — a coluna `iniciado_em` não existe.

- [ ] **Passo 3: a coluna aditiva e o backfill**

Em `scripts/lib/apply-schema.ts`, logo abaixo da entrada de `concluida_em`
(que já explica por que `concluida_em` é explícita e não derivada):

```ts
  // Quando o treino COMEÇOU, que não é quando a linha foi criada: entre as
  // duas coisas mora o rascunho — a sessão que existe, tem nome e plano, e
  // ainda não está acontecendo. NULL = rascunho. Ver BACKFILLS abaixo: sem o
  // acompanhamento, esta coluna transformaria todo o histórico em rascunho.
  { table: "workout_sessions", column: "iniciado_em", ddl: "ALTER TABLE workout_sessions ADD COLUMN iniciado_em TEXT" },
```

Depois de `ADDITIVE_INDEXES`, um bloco novo:

```ts
/**
 * O que uma coluna aditiva precisa que seja verdade nas linhas que já existem.
 *
 * `ALTER TABLE ADD COLUMN` deixa NULL em toda linha antiga, e para algumas
 * colunas NULL é uma afirmação errada, não a ausência de uma. `iniciado_em` é
 * o caso: no modelo anterior criar uma sessão ERA iniciá-la, então deixá-la
 * nula diria que nenhum treino já feito jamais começou — e como
 * `estadoDaSessao` lê isso como "rascunho", o histórico inteiro sumiria da
 * aba Progresso, da consistência e da análise no primeiro deploy.
 *
 * Todo comando aqui é idempotente pelo próprio `WHERE`, porque
 * `applyAdditiveColumns` roda a cada `db:setup`.
 */
const BACKFILLS: { table: string; sql: string }[] = [
  {
    table: "workout_sessions",
    sql: "UPDATE workout_sessions SET iniciado_em = created_at WHERE iniciado_em IS NULL",
  },
];
```

E, no fim de `applyAdditiveColumns`, depois do laço dos índices:

```ts
  for (const b of BACKFILLS) {
    if (!(await tableExists(db, b.table))) continue;
    await db.execute(b.sql);
  }
```

- [ ] **Passo 4: a coluna no schema, para um banco novo já nascer com ela**

Em `src/db/schema.sql`, dentro de `CREATE TABLE IF NOT EXISTS workout_sessions`,
depois de `nota TEXT`:

```sql
  iniciado_em TEXT,
  concluida_em TEXT,
```

> `concluida_em` só existia como coluna aditiva — um banco novo a ganhava pelo
> `ALTER TABLE`, nunca pelo `CREATE TABLE`. As duas passam a estar na
> definição; as entradas aditivas continuam onde estão, para os bancos que já
> rodaram sem elas.

- [ ] **Passo 5: os campos chegam ao cliente**

Em `src/domain/types.ts`, `WorkoutSession` ganha:

```ts
  iniciado_em: string | null;
  concluida_em: string | null;
```

Em `src/repositories/workouts.ts`, `mapSession`:

```ts
function mapSession(r: Row): WorkoutSession {
  return {
    id: r.id as number,
    data: r.data as string,
    nome: (r.nome as string | null) ?? null,
    nota: (r.nota as string | null) ?? null,
    iniciado_em: (r.iniciado_em as string | null) ?? null,
    concluida_em: (r.concluida_em as string | null) ?? null,
    created_at: r.created_at as string,
  };
}
```

- [ ] **Passo 6: rodar tudo**

`npm test` — os três novos passam. Type-check com `npm run build`; se algum
`WorkoutSession` literal em teste reclamar dos campos novos, complete-o em vez
de afrouxar o tipo.

- [ ] **Passo 7: commitar**

```bash
git add src/db/schema.sql scripts/lib/apply-schema.ts scripts/lib/apply-schema.test.ts \
        src/domain/types.ts src/repositories/workouts.ts
git commit -m "feat(treino): a sessão passa a registrar quando começou"
```

---

## Task 3: As transições

**Arquivos**
- Modificar: `src/repositories/sessao.ts` (`iniciarSessao` ~134, `registrarSerie` ~190, `registrarCardio`, `finalizarSessao` ~375)
- Modificar: `api/_lib/registro.ts` (bloco `sessao`)
- Modificar: `src/hooks/use-sessao.ts`
- Teste: `src/repositories/sessao.test.ts`

**Interfaces**
- Consome: `estadoDaSessao` (Task 1), a coluna `iniciado_em` (Task 2).
- Produz:
  `criarSessao(db, userId, { data, nome, itens }): Promise<number>` — nasce rascunho;
  `iniciarSessao(db, userId, sessionId): Promise<void>` — **assinatura nova**;
  `finalizarSessao(db, userId, sessionId): Promise<void>` — preenche os dois campos;
  hooks `useCriarSessao()`, `useIniciarTreino()`, `useDescartarSessao()`.

- [ ] **Passo 1: escrever os testes que falham**

Em `src/repositories/sessao.test.ts`, importando `criarSessao` e `getSession`
(de `./workouts`) junto do que já é importado:

```ts
describe("o ciclo de vida da sessão", () => {
  it("criarSessao nasce rascunho: sem início e sem fim", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    const s = await getSession(db, USER, sid);
    expect(s!.iniciado_em).toBeNull();
    expect(s!.concluida_em).toBeNull();
  });

  it("iniciarSessao marca o começo", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await iniciarSessao(db, USER, sid);
    const s = await getSession(db, USER, sid);
    expect(s!.iniciado_em).not.toBeNull();
    expect(s!.concluida_em).toBeNull();
  });

  it("iniciar duas vezes não move o começo", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await iniciarSessao(db, USER, sid);
    const primeiro = (await getSession(db, USER, sid))!.iniciado_em;
    await new Promise((r) => setTimeout(r, 5));
    await iniciarSessao(db, USER, sid);
    expect((await getSession(db, USER, sid))!.iniciado_em).toBe(primeiro);
  });

  it("iniciar a sessão de outro dono não faz nada", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await iniciarSessao(db, OUTRO, sid);
    expect((await getSession(db, USER, sid))!.iniciado_em).toBeNull();
  });

  it("registrar uma série num rascunho inicia o treino", async () => {
    const ex = await exercicio("Supino");
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Peito", itens: [item(ex)] });
    const plano = await getPlano(db, USER, sid);

    await registrarSerie(db, USER, plano[0].id, {
      reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    expect((await getSession(db, USER, sid))!.iniciado_em).not.toBeNull();
  });

  it("finalizar um rascunho preenche início e fim — nunca fim sem início", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await finalizarSessao(db, USER, sid);
    const s = await getSession(db, USER, sid);
    expect(s!.iniciado_em).not.toBeNull();
    expect(s!.concluida_em).not.toBeNull();
  });

  it("finalizar não move o início de quem já tinha um", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    await iniciarSessao(db, USER, sid);
    const inicio = (await getSession(db, USER, sid))!.iniciado_em;
    await finalizarSessao(db, USER, sid);
    expect((await getSession(db, USER, sid))!.iniciado_em).toBe(inicio);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/repositories/sessao.test.ts -t "ciclo de vida"`
Esperado: FAIL — `criarSessao` não é exportada.

- [ ] **Passo 3: `criarSessao` e a nova `iniciarSessao`**

Em `src/repositories/sessao.ts`, substituir a `iniciarSessao` atual por:

```ts
/**
 * Cria a sessão e escreve o plano dela. Nasce RASCUNHO.
 *
 * Era `iniciarSessao`, e criar era o mesmo evento que começar. Separar os dois
 * é o que torna possível montar um treino avulso com calma antes de o relógio
 * correr — e o que impede um treino recém-criado de aparecer no histórico como
 * se tivesse acontecido.
 */
export async function criarSessao(
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

/**
 * Rascunho → em andamento. Idempotente pela mesma razão que finalizar é:
 * reiniciar não pode empurrar o começo do treino para frente e encolher a
 * duração que já correu.
 */
export async function iniciarSessao(
  db: Client,
  userId: number,
  sessionId: number,
): Promise<void> {
  await db.execute({
    sql: `UPDATE workout_sessions SET iniciado_em = ?
          WHERE id = ? AND user_id = ? AND iniciado_em IS NULL`,
    args: [new Date().toISOString(), sessionId, userId],
  });
}
```

- [ ] **Passo 4: `finalizarSessao` fica íntegra**

```ts
/**
 * Marca a sessão como encerrada. Idempotente: reencerrar não muda a hora.
 *
 * Preenche `iniciado_em` junto quando ele está nulo. O botão "Finalizar" só
 * aparece em sessão já iniciada, mas o repositório não deve ser CAPAZ de
 * produzir um "concluído sem começo" — o dia em que a lista de abertos
 * finalizar um rascunho direto, o modelo continua íntegro.
 */
export async function finalizarSessao(
  db: Client,
  userId: number,
  sessionId: number,
): Promise<void> {
  const agora = new Date().toISOString();
  await db.execute({
    sql: `UPDATE workout_sessions
             SET concluida_em = ?, iniciado_em = COALESCE(iniciado_em, ?)
           WHERE id = ? AND user_id = ? AND concluida_em IS NULL`,
    args: [agora, agora, sessionId, userId],
  });
}
```

- [ ] **Passo 5: o auto-início ao registrar**

Perto do topo do arquivo, uma ajudante:

```ts
/**
 * Registrar é começar.
 *
 * Se uma série foi marcada como feita, o treino está acontecendo — exigir que
 * "Iniciar" tenha sido tocado antes transformaria um passo de conveniência
 * numa armadilha: o treino correria sem aparecer na faixa e sem duração. Vai
 * como comando no MESMO batch de quem registra, para não haver instante em
 * que a série existe e o começo não.
 */
function comandoDeAutoInicio(userId: number, sessionId: number) {
  return {
    sql: `UPDATE workout_sessions SET iniciado_em = ?
          WHERE id = ? AND user_id = ? AND iniciado_em IS NULL`,
    args: [new Date().toISOString(), sessionId, userId] as (number | string | null)[],
  };
}
```

Em `registrarSerie` e em `registrarCardio`, empurrar `comandoDeAutoInicio(userId, sessionId)`
no array `comandos` antes do `db.batch(comandos, "write")`. Nas duas o
`session_id` já foi lido da linha de plano — reuse a variável existente, não
consulte de novo.

- [ ] **Passo 6: o registro do RPC e os hooks**

Em `api/_lib/registro.ts`, no bloco `sessao`, em ordem alfabética:

```ts
  "sessao.criarSessao": { escopo: "usuario", fn: sessao.criarSessao },
```

(`sessao.iniciarSessao` e `sessao.finalizarSessao` continuam como estão — só o
argumento mudou.)

Em `src/hooks/use-sessao.ts`, substituir `useIniciarSessao` por:

```ts
/** Cria o rascunho — a rotina com o plano do dia, o avulso vazio. */
export function useCriarSessao() {
  const api = useApi();
  return useEscritaNaSessao(
    (v: { data: string; nome: string | null; itens: ItemPlanejado[] }) =>
      api["sessao"].criarSessao(v),
  );
}

/** Rascunho → em andamento. É o "Iniciar treino" da tela da academia. */
export function useIniciarTreino() {
  const api = useApi();
  return useEscritaNaSessao((sessionId: number) => api["sessao"].iniciarSessao(sessionId));
}

/**
 * Descartar um rascunho ou um treino aberto.
 *
 * `workouts.deleteSession` já leva plano, séries e o cardio de
 * `activity_sessions` junto — não há função nova a escrever, só uma tela que
 * ainda não a chamava.
 */
export function useDescartarSessao() {
  const api = useApi();
  return useEscritaNaSessao((sessionId: number) => api["workouts"].deleteSession(sessionId));
}
```

- [ ] **Passo 7: consertar as chamadas quebradas**

`npm run build` aponta cada uma. São `src/pages/treino.tsx` (troca
`useIniciarSessao` por `useCriarSessao`, mesma forma de argumento) e os testes
que chamavam `iniciarSessao(db, USER, {...})` — em `sessao.test.ts`,
`treino.test.tsx`, `treino-sessao.test.tsx`, `progresso.test.ts`.

Nos testes, a substituição é mecânica e a intenção decide qual usar:

```ts
// era: const sid = await iniciarSessao(db, USER, { data, nome, itens });
// vira, quando o teste quer um treino ACONTECENDO:
const sid = await criarSessao(db, USER, { data, nome, itens });
await iniciarSessao(db, USER, sid);
```

Onde o teste só precisa da sessão existindo, `criarSessao` sozinha basta.

- [ ] **Passo 8: rodar tudo e commitar**

`npm test` verde, `npm run build` limpo.

```bash
git add src/repositories/sessao.ts src/repositories/sessao.test.ts api/_lib/registro.ts \
        src/hooks/use-sessao.ts src/pages/treino.tsx src/pages/treino.test.tsx \
        src/pages/treino-sessao.test.tsx src/repositories/progresso.test.ts
git commit -m "feat(treino): criar um treino deixa de ser começá-lo"
```

---

## Task 4: Os treinos abertos, em qualquer dia

**Arquivos**
- Modificar: `src/repositories/sessao.ts` (`sessoesEmAndamento` ~417, `sessaoEmAndamento` ~442, `SessaoAberta` ~410)
- Modificar: `api/_lib/registro.ts`
- Modificar: `src/hooks/use-sessao.ts`
- Modificar: `src/pages/treino.tsx`, `src/pages/treino-sessao.tsx`, `src/pages/dashboard.tsx` (só as chamadas)
- Teste: `src/repositories/sessao.test.ts`

**Interfaces**
- Consome: Tasks 1–3.
- Produz:
  `interface SessaoAberta { session_id; nome; data; iniciado_em; total; feitas }`;
  `sessoesAbertas(db, userId): Promise<SessaoAberta[]>` — todas as não concluídas, todos os dias;
  `sessaoAtiva(db, userId): Promise<SessaoAberta | null>` — a mais recente **em andamento**;
  hooks `useSessoesAbertas()` e `useSessaoAtiva()`.

- [ ] **Passo 1: escrever os testes que falham**

```ts
describe("sessoesAbertas", () => {
  it("o treino aberto ONTEM continua aberto hoje", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-08-31", nome: "Costas", itens: [] });
    await iniciarSessao(db, USER, sid);

    const abertas = await sessoesAbertas(db, USER);

    expect(abertas.map((s) => s.session_id)).toContain(sid);
    expect(abertas[0].data).toBe("2026-08-31");
  });

  it("inclui o rascunho, com iniciado_em nulo", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Avulso", itens: [] });
    const abertas = await sessoesAbertas(db, USER);
    expect(abertas).toHaveLength(1);
    expect(abertas[0].session_id).toBe(sid);
    expect(abertas[0].iniciado_em).toBeNull();
  });

  it("não inclui a concluída", async () => {
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Peito", itens: [] });
    await iniciarSessao(db, USER, sid);
    await finalizarSessao(db, USER, sid);
    expect(await sessoesAbertas(db, USER)).toHaveLength(0);
  });

  it("não vê a sessão de outro dono", async () => {
    await criarSessao(db, OUTRO, { data: "2026-09-01", nome: "Alheio", itens: [] });
    expect(await sessoesAbertas(db, USER)).toHaveLength(0);
  });

  it("conta as séries feitas do plano", async () => {
    const ex = await exercicio("Supino");
    const sid = await criarSessao(db, USER, { data: "2026-09-01", nome: "Peito", itens: [item(ex)] });
    const plano = await getPlano(db, USER, sid);
    await registrarSerie(db, USER, plano[0].id, {
      reps: 10, peso_kg: 40, tipo: "valida", rir: null, nota: null,
    });

    const [aberta] = await sessoesAbertas(db, USER);
    expect(aberta.total).toBe(plano.length);
    expect(aberta.feitas).toBe(1);
  });
});

describe("sessaoAtiva", () => {
  it("ignora rascunho: um treino que não começou não está acontecendo", async () => {
    await criarSessao(db, USER, { data: "2026-09-01", nome: "Rascunho", itens: [] });
    expect(await sessaoAtiva(db, USER)).toBeNull();
  });

  it("devolve a mais recente em andamento", async () => {
    const antiga = await criarSessao(db, USER, { data: "2026-08-31", nome: "Costas", itens: [] });
    await iniciarSessao(db, USER, antiga);
    const nova = await criarSessao(db, USER, { data: "2026-09-01", nome: "Peito", itens: [] });
    await iniciarSessao(db, USER, nova);

    expect((await sessaoAtiva(db, USER))!.session_id).toBe(nova);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/repositories/sessao.test.ts -t "sessoesAbertas"`
Esperado: FAIL — `sessoesAbertas` não é exportada.

- [ ] **Passo 3: implementar**

Substituir `SessaoAberta`, `sessoesEmAndamento` e `sessaoEmAndamento` por:

```ts
/**
 * As sessões que ainda não foram encerradas — rascunhos e em andamento.
 *
 * Três decisões que este `SELECT` já errou:
 *
 * **`LEFT JOIN`, não `JOIN`.** Uma sessão sem nenhuma linha de plano
 * simplesmente não aparecia — e é exatamente assim que um treino avulso
 * nasce. No intervalo entre criar e adicionar o primeiro exercício o treino
 * era invisível, então sair da tela o perdia para sempre.
 *
 * **Todas, não `LIMIT 1`.** Treinar duas vezes no mesmo dia acontece, e com
 * uma sessão aberta o hub só sabia oferecer aquela.
 *
 * **Sem filtro de data.** Era `s.data = ?` com o hub sempre passando hoje: um
 * treino começado às 22h e não finalizado deixava de existir na virada da
 * meia-noite — irretomável, infinalizável, e fantasma no histórico para
 * sempre. Um treino aberto é aberto no dia em que você voltar.
 *
 * A `id` desempata a ordenação: duas sessões criadas no mesmo milissegundo têm
 * o mesmo `created_at`, e a id é monotônica quando o relógio não decide.
 */
export interface SessaoAberta {
  session_id: number;
  nome: string | null;
  data: string;
  iniciado_em: string | null;
  total: number;
  feitas: number;
}

export async function sessoesAbertas(db: Client, userId: number): Promise<SessaoAberta[]> {
  const rs = await db.execute({
    sql: `SELECT s.id AS session_id, s.nome AS nome, s.data AS data,
                 s.iniciado_em AS iniciado_em,
                 COUNT(p.id) AS total,
                 SUM(CASE WHEN p.set_id IS NOT NULL OR p.activity_id IS NOT NULL THEN 1 ELSE 0 END) AS feitas
          FROM workout_sessions s
          LEFT JOIN session_plan_sets p ON p.session_id = s.id
          WHERE s.user_id = ? AND s.concluida_em IS NULL
          GROUP BY s.id
          ORDER BY s.created_at DESC, s.id DESC`,
    args: [userId],
  });
  return rs.rows.map((r) => ({
    session_id: r.session_id as number,
    nome: (r.nome as string | null) ?? null,
    data: r.data as string,
    iniciado_em: (r.iniciado_em as string | null) ?? null,
    total: Number(r.total),
    feitas: Number(r.feitas ?? 0),
  }));
}

/**
 * O treino que está ACONTECENDO — o mais recente em andamento.
 *
 * A faixa e o dashboard perguntam isto, e a diferença para `sessoesAbertas` é
 * o rascunho: um treino montado e não iniciado existe, mas não está
 * acontecendo, e anunciá-lo como ativo faria a faixa mentir.
 */
export async function sessaoAtiva(db: Client, userId: number): Promise<SessaoAberta | null> {
  const abertas = await sessoesAbertas(db, userId);
  return abertas.find((s) => s.iniciado_em !== null) ?? null;
}
```

- [ ] **Passo 4: registro e hooks**

Em `api/_lib/registro.ts`: remover `sessao.sessoesEmAndamento` e
`sessao.sessaoEmAndamento`; acrescentar

```ts
  "sessao.sessaoAtiva": { escopo: "usuario", fn: sessao.sessaoAtiva },
  "sessao.sessoesAbertas": { escopo: "usuario", fn: sessao.sessoesAbertas },
```

Em `src/hooks/use-sessao.ts`, substituir `useSessaoEmAndamento` e
`useSessoesEmAndamento` por:

```ts
/**
 * Todos os treinos não concluídos, de qualquer dia.
 *
 * Sem chave de data de propósito: a lista muda quando uma sessão abre ou
 * fecha, não quando o relógio vira — e uma chave por dia deixava o treino de
 * ontem num cache que ninguém mais consultava.
 */
export function useSessoesAbertas() {
  const api = useApi();
  return useQuery({
    queryKey: ["sessao", "abertas"],
    queryFn: () => api["sessao"].sessoesAbertas(),
  });
}

/** O treino acontecendo agora — rascunho não conta. */
export function useSessaoAtiva() {
  const api = useApi();
  return useQuery({
    queryKey: ["sessao", "ativa"],
    queryFn: () => api["sessao"].sessaoAtiva(),
  });
}
```

- [ ] **Passo 5: atualizar as três chamadas, sem mexer na UI ainda**

- `src/pages/treino.tsx:67` — `useSessoesEmAndamento(data)` → `useSessoesAbertas()`.
- `src/pages/treino-sessao.tsx:374` — `useSessaoEmAndamento(hoje())` → `useSessaoAtiva()`
  (é o fallback de quando a URL não traz `?s=`).
- `src/pages/dashboard.tsx:80` — `useSessaoEmAndamento(data)` → `useSessaoAtiva()`.

O `hoje()` que ficar sem uso em `treino-sessao.tsx` continua importado — ele é
usado ao adicionar exercício.

- [ ] **Passo 6: rodar tudo e commitar**

`npm test` e `npm run build`.

```bash
git add src/repositories/sessao.ts src/repositories/sessao.test.ts api/_lib/registro.ts \
        src/hooks/use-sessao.ts src/pages/treino.tsx src/pages/treino-sessao.tsx src/pages/dashboard.tsx
git commit -m "fix(treino): o treino aberto ontem para de sumir na virada do dia"
```

---

## Task 5: O histórico exige conclusão

**Arquivos**
- Modificar: `src/repositories/workouts.ts` (`listSessions` ~75, `listSessionsByRange` ~181)
- Modificar: `src/repositories/progresso.ts` (`sessoesComResumo` ~34)
- Modificar: `src/pages/treino-sessao-detalhe.tsx` (~120 e ~136)
- Teste: `src/repositories/workouts.test.ts`, `src/repositories/progresso.test.ts`

**Interfaces**
- Consome: Tasks 1–4.
- Produz: nenhuma assinatura nova — o contrato que muda é semântico: as três
  consultas passam a devolver **só sessões concluídas**.

- [ ] **Passo 1: escrever os testes que falham**

Em `src/repositories/workouts.test.ts`:

```ts
describe("o histórico só mostra treino terminado", () => {
  it("listSessions ignora rascunho e treino em andamento", async () => {
    const rascunho = await criarSessao(db, USER, { data: "2026-09-01", nome: "Rascunho", itens: [] });
    const emCurso = await criarSessao(db, USER, { data: "2026-09-01", nome: "Em curso", itens: [] });
    await iniciarSessao(db, USER, emCurso);
    const feito = await criarSessao(db, USER, { data: "2026-09-01", nome: "Feito", itens: [] });
    await iniciarSessao(db, USER, feito);
    await finalizarSessao(db, USER, feito);

    const historico = await listSessions(db, USER);

    expect(historico.map((s) => s.id)).toEqual([feito]);
    expect(historico.map((s) => s.id)).not.toContain(rascunho);
    expect(historico.map((s) => s.id)).not.toContain(emCurso);
  });

  it("listSessionsByRange também", async () => {
    const emCurso = await criarSessao(db, USER, { data: "2026-09-01", nome: "Em curso", itens: [] });
    await iniciarSessao(db, USER, emCurso);

    expect(await listSessionsByRange(db, USER, "2026-09-01", "2026-09-01")).toHaveLength(0);
  });
});
```

Em `src/repositories/progresso.test.ts`:

```ts
it("sessoesComResumo ignora o treino que ainda não terminou", async () => {
  const emCurso = await criarSessao(db, USER, { data: "2026-09-01", nome: "Em curso", itens: [] });
  await iniciarSessao(db, USER, emCurso);

  expect((await sessoesComResumo(db, USER)).map((s) => s.id)).not.toContain(emCurso);
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/repositories/workouts.test.ts src/repositories/progresso.test.ts`
Esperado: FAIL — o histórico devolve as três sessões.

- [ ] **Passo 3: os três `WHERE`**

`src/repositories/workouts.ts`:

```ts
/**
 * O histórico: só o que terminou.
 *
 * Sem `concluida_em IS NOT NULL`, um treino entrava aqui no instante em que
 * era criado — tocar em "Começar" e sair da tela colocava o treino em curso no
 * meio dos treinos passados, que é a queixa que originou o ciclo de vida da
 * sessão. O que está acontecendo agora tem lugar próprio: `sessoesAbertas`.
 */
export async function listSessions(
  db: Client,
  userId: number,
  limite = 30,
): Promise<WorkoutSession[]> {
  const rs = await db.execute({
    sql: `SELECT * FROM workout_sessions
          WHERE user_id = ? AND concluida_em IS NOT NULL
          ORDER BY data DESC, created_at DESC LIMIT ?`,
    args: [userId, limite],
  });
  return rs.rows.map(mapSession);
}
```

E em `listSessionsByRange`, `AND concluida_em IS NOT NULL` antes do `ORDER BY`
— com o comentário de por quê:

```ts
/**
 * As sessões de um intervalo, para a análise. Só concluídas: `nSessoes` conta
 * treinos feitos, e um rascunho de dez segundos não é um deles.
 */
```

`src/repositories/progresso.ts`, em `sessoesComResumo`, a linha do `WHERE`:

```sql
      WHERE s.user_id = ? AND s.concluida_em IS NOT NULL
```

com o comentário sobre a consistência:

```ts
/**
 * (…docstring existente…)
 *
 * Só concluídas. Alimenta o histórico E a consistência (`treinosPorSemana`,
 * `estadoDosDias`), então um treino não finalizado deixa de contar como treino
 * do dia — que é a leitura certa, e a que o estado vazio da aba já promete:
 * "os treinos que você concluir aparecem aqui".
 */
```

- [ ] **Passo 4: o detalhe da sessão para de depender do recorte**

`treino-sessao-detalhe.tsx` acha a sessão que exibe fazendo `find` na lista de
200 do histórico — com o filtro, o detalhe de uma sessão aberta perderia o
cabeçalho inteiro.

Trocar o import `useSessoesComResumo` por `useSessao` (de `@/hooks/use-sessao`),
remover a linha `const { data: sessoes = [] } = useSessoesComResumo(200);` e:

```ts
  // Por id, não por `find` num recorte do histórico: aquela lista passou a
  // trazer só sessões concluídas, e uma sessão aberta aberta pelo endereço
  // direto ficaria sem cabeçalho. De quebra, sai uma consulta de 200 linhas
  // de uma tela que precisava de uma.
  const { data: sessao } = useSessao(sessionId);
```

Conferir os usos de `sessao` abaixo: `WorkoutSession` tem `nome`, `data` e
`nota`; se a tela lia algo que só `SessaoResumida` tinha (`series`, `volume_kg`),
esse número já vem de `plano`/`sets`, que a tela também consulta.

- [ ] **Passo 5: rodar tudo e commitar**

`npm test` e `npm run build`. Testes de `treino.test.tsx` que esperavam ver uma
sessão recém-criada em "Últimas sessões" agora falham corretamente — ajuste-os
para finalizar a sessão antes de esperar vê-la no histórico.

```bash
git add src/repositories/workouts.ts src/repositories/workouts.test.ts \
        src/repositories/progresso.ts src/repositories/progresso.test.ts \
        src/pages/treino-sessao-detalhe.tsx src/pages/treino.test.tsx
git commit -m "fix(treino): o histórico passa a mostrar só o treino que terminou"
```

---

## Task 6: O tempo decorrido

**Arquivos**
- Criar: `src/hooks/use-tempo-decorrido.ts`
- Teste: `src/hooks/use-tempo-decorrido.test.tsx`

**Interfaces**
- Consome: nada.
- Produz: `useTempoDecorrido(desde: string | null): string | null` — devolve
  `"32 min"`, `"1 h 12"`, `"14 h"`, ou `null` quando `desde` é nulo. Consumido
  pela faixa (Task 8) e pelo cabeçalho da academia (Task 7).

- [ ] **Passo 1: escrever o teste que falha**

```tsx
// src/hooks/use-tempo-decorrido.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTempoDecorrido, formatarDecorrido } from "./use-tempo-decorrido";

afterEach(() => vi.useRealTimers());

describe("formatarDecorrido", () => {
  it("abaixo de uma hora, minutos", () => {
    expect(formatarDecorrido(0)).toBe("agora");
    expect(formatarDecorrido(59_000)).toBe("agora");
    expect(formatarDecorrido(32 * 60_000)).toBe("32 min");
  });

  it("de uma hora em diante, horas e minutos", () => {
    expect(formatarDecorrido(72 * 60_000)).toBe("1 h 12");
    expect(formatarDecorrido(60 * 60_000)).toBe("1 h");
    expect(formatarDecorrido(14 * 60 * 60_000)).toBe("14 h");
  });
});

describe("useTempoDecorrido", () => {
  it("sem início, não há tempo", () => {
    const { result } = renderHook(() => useTempoDecorrido(null));
    expect(result.current).toBeNull();
  });

  it("conta a partir do instante dado e continua contando", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T10:30:00.000Z"));
    const { result } = renderHook(() =>
      useTempoDecorrido("2026-09-01T10:00:00.000Z"),
    );
    expect(result.current).toBe("30 min");

    act(() => { vi.advanceTimersByTime(120_000); });
    expect(result.current).toBe("32 min");
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/hooks/use-tempo-decorrido.test.tsx`
Esperado: FAIL — módulo não existe.

- [ ] **Passo 3: implementar**

```ts
// src/hooks/use-tempo-decorrido.ts
import { useEffect, useState } from "react";

/**
 * Quanto tempo passou, para ler de relance no meio de uma série.
 *
 * Não é `mm:ss`: o número que importa num treino é "faz meia hora", não o
 * segundo — e um segundo piscando no rodapé disputa atenção com o cronômetro
 * de descanso, que é onde os segundos de fato contam.
 */
export function formatarDecorrido(ms: number): string {
  const min = Math.floor(Math.max(ms, 0) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h} h` : `${h} h ${resto}`;
}

/**
 * O tempo desde um instante ISO, ticando de segundo em segundo.
 *
 * Nada é persistido: o relógio de parede é a fonte, então fechar o app e
 * voltar duas horas depois dá o número certo sem nenhum estado salvo. É o
 * princípio do `fimTs` do `CronometroDescanso` — aquele precisa do
 * `localStorage` porque o alvo é uma escolha do usuário; este deriva de uma
 * coluna do banco, que já sobreviveu ao app fechar.
 *
 * O intervalo não é criado quando não há o que contar: sem sessão ativa, a
 * faixa não existe e um tique por segundo seria trabalho para ninguém.
 */
export function useTempoDecorrido(desde: string | null): string | null {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (desde === null) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [desde]);

  if (desde === null) return null;
  const inicio = Date.parse(desde);
  if (Number.isNaN(inicio)) return null;
  return formatarDecorrido(agora - inicio);
}
```

- [ ] **Passo 4: rodar e ver passar**

`npx vitest run src/hooks/use-tempo-decorrido.test.tsx` → tudo verde.

- [ ] **Passo 5: commitar**

```bash
git add src/hooks/use-tempo-decorrido.ts src/hooks/use-tempo-decorrido.test.tsx
git commit -m "feat(treino): o tempo decorrido sai do relógio de parede"
```

---

## Task 7: O rodapé da academia por estado

**Arquivos**
- Modificar: `src/pages/treino-sessao.tsx` (rodapé ~659, cabeçalho, imports)
- Teste: `src/pages/treino-sessao.test.tsx`

**Interfaces**
- Consome: `estadoDaSessao` (1), `useIniciarTreino`/`useDescartarSessao` (3),
  `useTempoDecorrido` (6), `SheetConfirmar` (`@/components/ui/confirmar`).
- Produz: nada que outra tarefa consuma.

- [ ] **Passo 1: escrever os testes que falham**

Em `src/pages/treino-sessao.test.tsx` (siga o `montar()` que o arquivo já tem
para renderizar com `?s=`):

```ts
it("rascunho oferece iniciar, não finalizar", async () => {
  const sid = await criarSessao(db, USER, { data: hoje(), nome: "Avulso", itens: [] });
  montar(sid);

  expect(await screen.findByRole("button", { name: /iniciar treino/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /finalizar/i })).not.toBeInTheDocument();
});

it("iniciar marca o começo e passa a oferecer finalizar", async () => {
  const sid = await criarSessao(db, USER, { data: hoje(), nome: "Avulso", itens: [] });
  montar(sid);

  await userEvent.click(await screen.findByRole("button", { name: /iniciar treino/i }));

  expect(await screen.findByRole("button", { name: /finalizar/i })).toBeInTheDocument();
  const rs = await db.execute({
    sql: "SELECT iniciado_em FROM workout_sessions WHERE id = ?", args: [sid],
  });
  expect(rs.rows[0].iniciado_em).not.toBeNull();
});

it("descartar apaga a sessão", async () => {
  const sid = await criarSessao(db, USER, { data: hoje(), nome: "Avulso", itens: [] });
  montar(sid);

  await userEvent.click(await screen.findByRole("button", { name: /descartar/i }));
  await userEvent.click(await screen.findByRole("button", { name: /^descartar$/i }));

  await waitFor(async () => {
    const rs = await db.execute({
      sql: "SELECT id FROM workout_sessions WHERE id = ?", args: [sid],
    });
    expect(rs.rows).toHaveLength(0);
  });
});

it("sessão concluída não oferece finalizar de novo", async () => {
  const sid = await criarSessao(db, USER, { data: hoje(), nome: "Peito", itens: [] });
  await iniciarSessao(db, USER, sid);
  await finalizarSessao(db, USER, sid);
  montar(sid);

  expect(await screen.findByText(/concluído/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /finalizar/i })).not.toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/pages/treino-sessao.test.tsx`
Esperado: FAIL — não existe botão "Iniciar treino".

- [ ] **Passo 3: o estado no componente**

Em `TreinoSessao`, junto dos outros hooks:

```tsx
  const iniciarTreino = useIniciarTreino();
  const descartar = useDescartarSessao();
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  // A sessão pode não ter carregado ainda; até lá o rodapé não decide nada.
  const estado = sessao ? estadoDaSessao(sessao) : null;
  const decorrido = useTempoDecorrido(sessao?.iniciado_em ?? null);
```

- [ ] **Passo 4: o rodapé**

Substituir o `<footer>` inteiro por:

```tsx
      <footer className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-lg">
        {estado === "rascunho" ? (
          <>
            <Button
              block
              size="lg"
              disabled={iniciarTreino.isPending}
              onClick={() => iniciarTreino.mutate(sessionId)}
            >
              <Play className="size-4" />
              Iniciar treino
            </Button>
            <button
              type="button"
              onClick={() => setConfirmandoDescarte(true)}
              className="mt-1 flex min-h-11 w-full items-center justify-center text-[0.8125rem] font-medium text-muted-foreground"
            >
              Descartar
            </button>
          </>
        ) : estado === "concluida" ? (
          /* Antes daqui, abrir `?s=` de uma sessão fechada continuava
             oferecendo "Finalizar" — inócuo por idempotência, e mentiroso. */
          <div className="text-center">
            <p className="t-caption">Treino concluído</p>
            <Link
              to={`/treino/sessao/${sessionId}`}
              className="mt-1 inline-flex min-h-11 items-center text-[0.8125rem] font-medium text-primary"
            >
              Ver no histórico
            </Link>
          </div>
        ) : (
          <Button
            block
            size="lg"
            disabled={finalizar.isPending}
            onClick={() =>
              finalizar.mutate(sessionId, { onSuccess: () => navigate("/treino") })
            }
          >
            {plano.length > 0 && feitas === plano.length
              ? "Finalizar treino"
              : `Finalizar (${feitas} de ${plano.length})`}
          </Button>
        )}
      </footer>
```

E, junto dos outros sheets no fim do componente:

```tsx
      <SheetConfirmar
        aberto={confirmandoDescarte}
        onFechar={() => setConfirmandoDescarte(false)}
        titulo="Descartar este treino?"
        descricao="A sessão e tudo que você já registrou nela somem. Não tem desfazer."
        rotulo="Descartar"
        onConfirmar={() =>
          descartar.mutate(sessionId, { onSuccess: () => navigate("/treino") })
        }
      />
```

- [ ] **Passo 5: o tempo no cabeçalho**

No cabeçalho da tela, ao lado do nome da sessão, quando `decorrido` existir:

```tsx
{decorrido && <span className="t-caption tabular-nums">{decorrido}</span>}
```

- [ ] **Passo 6: rodar e commitar**

`npx vitest run src/pages/treino-sessao.test.tsx`, depois `npm test` e
`npm run build`.

```bash
git add src/pages/treino-sessao.tsx src/pages/treino-sessao.test.tsx
git commit -m "feat(treino): a academia ganha iniciar, descartar e um rodapé que diz a verdade"
```

---

## Task 8: A faixa fixa

**Arquivos**
- Criar: `src/components/faixa-treino-ativo.tsx`
- Teste: `src/components/faixa-treino-ativo.test.tsx`
- Modificar: `src/App.tsx` (`ProtectedLayout`, linhas 32–56)

**Interfaces**
- Consome: `useSessoesAbertas` (4), `useTempoDecorrido` (6).
- Produz: `<FaixaTreinoAtivo />`, sem props — lê tudo dos hooks.

- [ ] **Passo 1: escrever o teste que falha**

```tsx
// src/components/faixa-treino-ativo.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { FaixaTreinoAtivo } from "./faixa-treino-ativo";
import { criarSessao, iniciarSessao, finalizarSessao } from "../repositories/sessao";
import { hoje } from "../lib/date";

const USER = 1;
let db: Client;

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <FaixaTreinoAtivo />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("FaixaTreinoAtivo", () => {
  it("sem treino aberto, não existe", async () => {
    montar();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("ignora rascunho: montado não é acontecendo", async () => {
    await criarSessao(db, USER, { data: hoje(), nome: "Rascunho", itens: [] });
    montar();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/rascunho/i)).not.toBeInTheDocument();
  });

  it("mostra o treino em andamento e leva de volta a ele", async () => {
    const sid = await criarSessao(db, USER, { data: hoje(), nome: "Peito e Tríceps", itens: [] });
    await iniciarSessao(db, USER, sid);

    montar();

    const link = await screen.findByRole("link", { name: /peito e tríceps/i });
    expect(link).toHaveAttribute("href", `/treino/sessao?s=${sid}`);
  });

  it("com dois treinos abertos, avisa que há mais um", async () => {
    const a = await criarSessao(db, USER, { data: hoje(), nome: "Costas", itens: [] });
    await iniciarSessao(db, USER, a);
    const b = await criarSessao(db, USER, { data: hoje(), nome: "Pernas", itens: [] });
    await iniciarSessao(db, USER, b);

    montar();

    expect(await screen.findByText(/\+1/)).toBeInTheDocument();
  });

  it("some quando o treino é finalizado", async () => {
    const sid = await criarSessao(db, USER, { data: hoje(), nome: "Peito", itens: [] });
    await iniciarSessao(db, USER, sid);
    await finalizarSessao(db, USER, sid);

    montar();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/peito/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/components/faixa-treino-ativo.test.tsx`
Esperado: FAIL — módulo não existe.

- [ ] **Passo 3: implementar**

```tsx
// src/components/faixa-treino-ativo.tsx
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useSessoesAbertas } from "@/hooks/use-sessao";
import { useTempoDecorrido } from "@/hooks/use-tempo-decorrido";

/**
 * O treino que está acontecendo, visível de qualquer tela.
 *
 * Antes dela o único sinal de um treino em curso era um card dentro da aba
 * "Hoje" do treino: ir para a Nutrição, para o Dashboard ou fechar o app
 * significava perder o treino de vista, sem tempo decorrido e sem caminho de
 * volta — e foi assim que sessões ficavam abertas por dias.
 *
 * Fica no `ProtectedLayout`, e não no App inteiro, porque `/treino/sessao`
 * está FORA daquele layout: a faixa some sozinha exatamente onde ela seria
 * redundante, sem precisar consultar a rota.
 *
 * Rascunho não aparece. Ele existe, mas não está acontecendo — anunciá-lo
 * aqui, com um cronômetro correndo, seria a faixa mentindo sobre o que a
 * pessoa está fazendo.
 */
export function FaixaTreinoAtivo() {
  const { data: abertas = [] } = useSessoesAbertas();
  const ativas = abertas.filter((s) => s.iniciado_em !== null);
  const atual = ativas[0];
  const decorrido = useTempoDecorrido(atual?.iniciado_em ?? null);

  if (!atual) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-2 pb-2">
      <Link
        to={`/treino/sessao?s=${atual.session_id}`}
        className="mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-primary/25 bg-tint-primary px-3 py-2.5 shadow-lg backdrop-blur-lg"
      >
        {/* O ponto pulsando é o que diz "agora" sem gastar uma palavra. */}
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {atual.nome ?? "Treino"}
            {ativas.length > 1 && (
              <span className="t-caption ml-1.5 font-normal">+{ativas.length - 1}</span>
            )}
          </span>
          <span className="t-caption block truncate tabular-nums">
            {decorrido}
            {atual.total > 0 && ` · ${atual.feitas} de ${atual.total} séries`}
          </span>
        </span>

        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}
```

- [ ] **Passo 4: montar no layout**

Em `src/App.tsx`, dentro de `ProtectedLayout`. O padding inferior passou a ter
quatro combinações (com/sem registro rápido × com/sem faixa), o que não cabe
mais num ternário — extraia:

```tsx
function ProtectedLayout() {
  const { pathname } = useLocation();
  const comRegistroRapido = COM_REGISTRO_RAPIDO.includes(pathname);

  return (
    <RequireAuth>
      <DataProvider>
        {/* A folga inferior cobre a barra de navegação e o que estiver
            flutuando sobre ela — o botão de registro rápido, a faixa do treino
            em curso, ou os dois. Sem ela, o último card fica debaixo de algo.
            A faixa entra na conta sempre que a rota pode tê-la: medir a
            presença dela aqui exigiria subir o estado do treino para o layout,
            e 3,5rem de folga a mais não custam nada numa tela que rola. */}
        <div
          className={cn(
            "mx-auto min-h-dvh max-w-lg",
            comRegistroRapido
              ? "pb-[calc(11rem+env(safe-area-inset-bottom))]"
              : "pb-[calc(7.5rem+env(safe-area-inset-bottom))]",
          )}
        >
          <Outlet />
          {comRegistroRapido && <QuickAdd />}
          <FaixaTreinoAtivo />
          <BottomNav />
        </div>
      </DataProvider>
    </RequireAuth>
  );
}
```

Importar `FaixaTreinoAtivo` e `cn` (de `./lib/utils`) no topo.

- [ ] **Passo 5: rodar e commitar**

`npx vitest run src/components/faixa-treino-ativo.test.tsx`, depois `npm test` e
`npm run build`.

```bash
git add src/components/faixa-treino-ativo.tsx src/components/faixa-treino-ativo.test.tsx src/App.tsx
git commit -m "feat(treino): o treino em curso passa a aparecer em qualquer tela"
```

---

## Task 9: O hub — a lista de abertos e a entrada

**Arquivos**
- Modificar: `src/pages/treino.tsx`
- Modificar: `src/components/treino/sheet-treino-avulso.tsx`
- Teste: `src/pages/treino.test.tsx`

**Interfaces**
- Consome: tudo das tarefas 1–6.
- Produz: nada que outra tarefa consuma. É a última.

- [ ] **Passo 1: escrever os testes que falham**

```ts
it("criar um avulso não põe nada no histórico", async () => {
  montar();
  await userEvent.click(await screen.findByRole("button", { name: /treino avulso/i }));
  await userEvent.click(await screen.findByRole("button", { name: /^criar$/i }));

  // A sessão existe...
  await waitFor(async () => {
    const rs = await db.execute("SELECT id, iniciado_em FROM workout_sessions");
    expect(rs.rows).toHaveLength(1);
    expect(rs.rows[0].iniciado_em).toBeNull();
  });
  // ...e não está entre as últimas sessões.
  expect(screen.queryByText(/últimas sessões/i)).not.toBeInTheDocument();
});

it("lista o rascunho com continuar e descartar", async () => {
  await criarSessao(db, USER, { data: HOJE_ISO, nome: "Avulso da noite", itens: [] });
  montar();

  expect(await screen.findByText(/avulso da noite/i)).toBeInTheDocument();
  expect(screen.getByText(/não iniciado/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /continuar montando/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /descartar/i })).toBeInTheDocument();
});

it("lista o treino de ontem que ficou aberto", async () => {
  const sid = await criarSessao(db, USER, { data: diasAtras(HOJE_ISO, 1), nome: "Costas", itens: [] });
  await iniciarSessao(db, USER, sid);

  montar();

  expect(await screen.findByText(/costas/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /retomar/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /finalizar/i })).toBeInTheDocument();
});

it("finalizar da lista tira o treino de lá", async () => {
  const sid = await criarSessao(db, USER, { data: HOJE_ISO, nome: "Costas", itens: [] });
  await iniciarSessao(db, USER, sid);
  montar();

  await userEvent.click(await screen.findByRole("button", { name: /finalizar/i }));

  await waitFor(async () => {
    const rs = await db.execute({
      sql: "SELECT concluida_em FROM workout_sessions WHERE id = ?", args: [sid],
    });
    expect(rs.rows[0].concluida_em).not.toBeNull();
  });
});
```

Importar `diasAtras` de `../lib/date` e `criarSessao`/`iniciarSessao` do
repositório.

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/pages/treino.test.tsx`
Esperado: FAIL — o botão da sheet ainda diz "Começar", e não há "não iniciado".

- [ ] **Passo 3: a sheet cria em vez de começar**

Em `sheet-treino-avulso.tsx`: `onComecar` → `onCriar`, o rótulo do botão para
`Criar treino`, e a descrição:

```tsx
          <SheetDescription>
            Uma sessão vazia, fora da rotina. Você monta os exercícios e decide
            quando ela começa.
          </SheetDescription>
```

O ícone `Play` sai (não se está começando nada) — use `Plus`.

Atualizar a docstring do componente para explicar que ele cria um rascunho.

- [ ] **Passo 4: a lista de treinos abertos**

Em `treino.tsx`, uma função de apresentação acima de `Treino`:

```tsx
/**
 * Uma linha da lista de treinos abertos.
 *
 * Rascunho e em andamento moram na mesma lista de propósito: os dois são
 * "coisas que você começou e não fechou", e separá-los em dois cards faria a
 * tela perguntar duas vezes o que ela só precisa perguntar uma. O que os
 * distingue são as AÇÕES — um se inicia, o outro se finaliza.
 */
function LinhaAberta({
  sessao,
  onFinalizar,
  onDescartar,
}: {
  sessao: SessaoAberta;
  onFinalizar: (id: number) => void;
  onDescartar: (id: number) => void;
}) {
  const estado = estadoDaSessao({
    iniciado_em: sessao.iniciado_em,
    concluida_em: null,
  });
  const decorrido = useTempoDecorrido(sessao.iniciado_em);
  const emCurso = estado === "andamento";

  const progresso =
    sessao.total === 0
      ? "sem exercício ainda"
      : `${sessao.feitas} de ${sessao.total} séries`;

  return (
    <Card tone={emCurso ? "primary" : "default"}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-title min-w-0 truncate">{sessao.nome ?? "Treino"}</h2>
        <span className="t-caption shrink-0">
          {emCurso ? "em andamento" : "não iniciado"}
        </span>
      </div>
      <p className="t-caption mt-1 tabular-nums">
        {emCurso ? `${dataRelativa(sessao.data)} · faz ${decorrido}` : dataRelativa(sessao.data)}
        {" · "}
        {progresso}
      </p>

      <div className="mt-4 flex gap-2">
        <ButtonLink to={`/treino/sessao?s=${sessao.session_id}`} block>
          <Play className="size-4" />
          {emCurso ? "Retomar" : "Continuar montando"}
        </ButtonLink>
        {emCurso ? (
          <Button variant="outline" block onClick={() => onFinalizar(sessao.session_id)}>
            Finalizar
          </Button>
        ) : (
          <Button variant="outline" block onClick={() => onDescartar(sessao.session_id)}>
            Descartar
          </Button>
        )}
      </div>
    </Card>
  );
}
```

Em `Treino`, o bloco `abertas.length > 0` passa a ordenar (em andamento antes)
e a renderizar `LinhaAberta`:

```tsx
  const finalizar = useFinalizarSessao();
  const descartar = useDescartarSessao();
  const [descartando, setDescartando] = useState<number | null>(null);

  // Em andamento primeiro: o treino acontecendo é o que a pessoa abriu o app
  // para ver. `sessoesAbertas` já entrega o mais recente na frente dentro de
  // cada grupo.
  const ordenadas = [...abertas].sort(
    (a, b) => Number(b.iniciado_em !== null) - Number(a.iniciado_em !== null),
  );
```

O ramo do JSX:

```tsx
        <>
          {ordenadas.map((s) => (
            <LinhaAberta
              key={s.session_id}
              sessao={s}
              onFinalizar={(id) => finalizar.mutate(id)}
              onDescartar={(id) => setDescartando(id)}
            />
          ))}
          <div className="flex justify-center">{botaoAvulso}</div>
        </>
```

E o sheet de confirmação, junto do `SheetTreinoAvulso`:

```tsx
      <SheetConfirmar
        aberto={descartando !== null}
        onFechar={() => setDescartando(null)}
        titulo="Descartar este treino?"
        descricao="A sessão e tudo que você já registrou nela somem. Não tem desfazer."
        rotulo="Descartar"
        onConfirmar={() => descartando !== null && descartar.mutate(descartando)}
      />
```

- [ ] **Passo 5: "Começar treino" da rotina cria rascunho**

A função `comecar` já usa `useCriarSessao` desde a Task 3. Renomeie-a para
`criar` e ajuste o rótulo do botão da rotina para **"Montar treino"**, com o
comentário:

```tsx
          {/* "Montar", não "Começar": o toque cria o rascunho e leva à tela,
              onde "Iniciar treino" é que faz o relógio correr. Um caminho só
              para rotina e avulso — duas semânticas de "começar" foi
              exatamente o que produziu sessões que nasciam no histórico. */}
```

- [ ] **Passo 6: rodar tudo e commitar**

`npm test` e `npm run build`.

```bash
git add src/pages/treino.tsx src/pages/treino.test.tsx src/components/treino/sheet-treino-avulso.tsx
git commit -m "feat(treino): o hub lista os treinos abertos e sabe fechá-los"
```

---

## Verificação final

- [ ] `npm test` — tudo verde.
- [ ] `npm run build` — sem erro de tipo.
- [ ] Manual, em `npm run dev`:
  - Criar um avulso, **sair para a Nutrição**: nada na faixa (é rascunho), e
    nada em "Últimas sessões".
  - Voltar ao rascunho, tocar "Iniciar treino", sair para o Dashboard: a faixa
    aparece com o tempo correndo, e o toque volta ao treino.
  - Registrar uma série num rascunho sem tocar "Iniciar": a faixa aparece
    sozinha.
  - Finalizar: a faixa some e o treino aparece em "Últimas sessões".
  - Com um treino aberto, mudar a data do sistema para o dia seguinte e
    recarregar: o treino continua na lista de abertos, marcado como de ontem.
