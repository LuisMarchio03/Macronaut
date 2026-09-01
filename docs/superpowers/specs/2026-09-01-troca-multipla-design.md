# A refeição do dia trocada por mais de um alimento — desenho

Hoje uma linha do plano aceita **uma** troca por dia, e o card da refeição
mostra a caloria do plano mesmo depois de você comer outra coisa. Este desenho
dá à linha N alimentos, dá à refeição a possibilidade de dispensar linhas, e
faz o card contar o que você de fato escolheu.

Escopo escolhido pelo usuário: **vários alimentos por linha + dispensar
linhas**, e **realizado ao lado da meta** no card.

---

## O problema

**P1 · Uma linha do plano só aceita um alimento.**
`plan_item_swaps` tem `UNIQUE (user_id, data, item_id)`, e `salvarTroca` é um
upsert sobre essa chave: trocar de novo CORRIGE a troca anterior. É o desenho
certo para "errei, quis dizer outra coisa", e o desenho errado para "comi duas
coisas no lugar dessa". Quem come pão E suco no lugar dos ovos não tem como
dizer isso.

**P2 · Não dá para dizer "não comi esta linha".**
As três respostas possíveis hoje são "segui o plano", "troquei por X" e o
silêncio. Trocar a refeição inteira por dois alimentos exige, na prática,
inventar uma troca para cada uma das outras linhas — o que produz um registro
falso.

**P3 · A caloria do card ignora a troca.**
`bloco-card.tsx:106` mostra `~${bloco.kcal_alvo}` — a meta que veio da
planilha do nutricionista. Trocar 400 kcal de café da manhã por um lanche de
700 não muda o número, então a tela não avisa nada no único momento em que
avisar importa.

Os três têm a mesma origem: **a troca foi modelada como uma correção pontual
de uma linha, e o que o usuário faz é remontar a refeição do dia.**

---

## Decisões

Fechadas com o usuário antes do desenho:

1. **N alimentos por linha, mais dispensar linhas.** A alternativa descartada
   era um botão "substituir a refeição inteira" com uma lista livre, que
   resolveria o caso mas perderia qual item substituiu qual.
2. **Realizado ao lado da meta:** `380 / ~400 kcal`, com sinal de atenção ao
   estourar, e `380+` quando alguma escolha não tem caloria conhecida. O card
   sem troca continua mostrando só `~400 kcal`.

---

## 1 · O esquema

### O `UNIQUE` sai, a dispensa entra

```sql
-- Antes:
UNIQUE (user_id, data, item_id),
CHECK ((swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)

-- Depois: sem UNIQUE, mais a coluna `dispensado`, e o CHECK com duas formas.
dispensado INTEGER NOT NULL DEFAULT 0,
CHECK (
  (dispensado = 1 AND swap_id IS NULL AND food_id IS NULL AND texto IS NULL)
  OR
  (dispensado = 0
   AND (swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
)
```

Uma **dispensa** é uma linha sem origem nenhuma: você não comeu aquilo, e não
comeu outra coisa no lugar. Ela é exclusiva — dispensar apaga as trocas da
linha, e trocar apaga a dispensa —, o que o banco garante pela metade e o
repositório garante inteiro:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_item_swaps_dispensa
  ON plan_item_swaps (user_id, data, item_id) WHERE dispensado = 1;
```

O índice impede duas dispensas na mesma linha; a exclusão mútua entre dispensa
e troca é do repositório, porque um `CHECK` não enxerga outras linhas.

### A migração é uma reconstrução

**Esta é a única parte arriscada do trabalho.** SQLite não remove `UNIQUE` nem
altera `CHECK` com `ALTER TABLE` — a tabela precisa ser recriada e os dados
copiados. `scripts/lib/apply-schema.ts` só sabe `ADD COLUMN`, então ganha um
mecanismo novo, ao lado dos que já existem:

```ts
const REBUILDS: { table: string; obsoleto: RegExp; passos: string[] }[]
```

Cada entrada diz qual tabela, como RECONHECER o formato antigo lendo
`sqlite_master.sql`, e os passos da reconstrução. O reconhecimento por regex
sobre o DDL guardado é o que torna o passo idempotente: rodou uma vez, a
tabela deixa de casar com `obsoleto` e o `db:setup` seguinte não faz nada.

Os passos, na ordem obrigatória:

```sql
CREATE TABLE plan_item_swaps_nova (…);      -- o formato novo
INSERT INTO plan_item_swaps_nova (…)        -- tudo, com dispensado = 0
  SELECT id, user_id, data, block_id, item_id, swap_id, food_id, texto,
         qty_g, measure_id, medidas, kcal, created_at, 0
    FROM plan_item_swaps;
DROP TABLE plan_item_swaps;
ALTER TABLE plan_item_swaps_nova RENAME TO plan_item_swaps;
CREATE INDEX  … idx_plan_item_swaps_dia …;
CREATE UNIQUE INDEX … idx_plan_item_swaps_dispensa …;
```

Vai por **`db.migrate([...])`**, e não por `db.batch`: é o modo do `@libsql/client`
para DDL transacional — ele desliga a checagem de chave estrangeira durante a
troca e volta a ligar depois. Com `batch`, o `DROP TABLE` no meio de um lote
com FKs ativas falha ou deixa a tabela pela metade.

Toda troca já gravada é preservada, com `dispensado = 0` — ela é uma troca de
verdade, e continua sendo uma depois da mudança.

### O que se perde, assumido

O `UNIQUE` também servia de rede contra duplicata acidental: dois toques
rápidos no mesmo botão gravavam uma linha só. Sem ele, gravam duas iguais. A
defesa passa a ser a tela (§3): o botão desabilita enquanto a escrita está em
voo, e a lista do que já foi adicionado fica visível acima dele — duplicar
passa a ser visível, e desfazível num toque.

---

## 2 · O domínio

`src/domain/plano-dia.ts`.

| Antes | Depois |
| --- | --- |
| `trocaDoItem(trocas, itemId): TrocaDeItem \| null` | `trocasDoItem(trocas, itemId): TrocaDeItem[]` |
| — | `itemDispensado(trocas, itemId): boolean` |
| — | `kcalDaRefeicao(itens, trocas): { total: number; incompleto: boolean }` |
| `descreverTroca(t)` | inalterada — descreve UMA troca; a tela empilha N |

`TrocaDeItem` ganha `dispensado: boolean`. `mapTroca` o preenche, e a `origem`
de uma dispensa não é consultada por ninguém — as telas testam `dispensado`
primeiro.

### `itensResolvidos` passa a ter três saídas

Hoje devolve `{ lancaveis, semAlimento }`. Uma linha dispensada não pertence a
nenhuma das duas: ela não vai para o diário, e dizer "não entra no balanço"
sobre algo que você deliberadamente não comeu é ruído, não aviso.

```ts
{ lancaveis: LancamentoDoPlano[]; semAlimento: PlanItem[]; dispensados: PlanItem[] }
```

E `lancaveis` deixa de ser um por item: uma linha com três trocas rende três
lançamentos no diário quando você toca "Comi". A regra que já valia continua
valendo — **item trocado só é lançado pelas trocas dele**, nunca caindo de
volta no alimento original.

### `kcalDaRefeicao`

```ts
export function kcalDaRefeicao(
  itens: PlanItem[],
  trocas: TrocaDeItem[],
): { total: number; incompleto: boolean };
```

Soma, por linha: as trocas quando existem, nada quando dispensada, e a linha
do plano quando intacta. `incompleto` fica `true` quando alguma parcela é
desconhecida — uma troca de texto sem caloria, ou uma linha do plano sem
alimento casado. É ele que vira o `+` de "380+ / ~400": o app não pode somar o
que não sabe, e calar isso contaria zero.

**Sem troca nenhuma a função não é chamada.** O card mostra `kcal_alvo`, como
hoje — a meta do nutricionista é uma afirmação melhor sobre um dia intacto do
que a soma parcial das linhas que o importador conseguiu casar.

---

## 3 · O repositório

`src/repositories/plano.ts`.

| Função | Mudança |
| --- | --- |
| `salvarTroca` | **vira `adicionarTroca`**: `INSERT` puro, sem `ON CONFLICT`. Apaga a dispensa da linha, se houver. |
| `removerTroca(data, itemId)` | continua: limpa a linha inteira (o `×` do item). |
| `removerUmaTroca(trocaId)` | **nova**: o `×` de um alimento só. |
| `dispensarItem(data, blockId, itemId)` | **nova**: apaga as trocas e grava a dispensa, no mesmo `batch`. |
| `listTrocasDoDia` | `ORDER BY t.item_id, t.id` — a ordem de escolha é a ordem que a tela mostra. |
| `marcarBloco` | inalterada: `itensResolvidos` já entrega N lançáveis. |

`api/_lib/registro.ts` acompanha: `plano.salvarTroca` sai, entram
`plano.adicionarTroca`, `plano.removerUmaTroca` e `plano.dispensarItem`.

---

## 4 · As telas

### Nível 2 — a linha (`TrocarItem`)

Acima das abas, a lista do que já foi escolhido para esta linha, cada um com
um `×`. É ela que substitui a rede que o `UNIQUE` dava: duplicar fica visível.

O botão de confirmar diz **"Trocar por X"** quando a linha está intacta e
**"Adicionar X"** quando já há alguma escolha — o verbo tem que dizer o que o
toque faz, e "trocar" pela segunda vez sugeriria substituir a primeira.

No rodapé, **"Não comi esta linha"**. Numa linha já dispensada, ele vira
"Voltar ao plano".

Confirmar uma escolha **não avança mais automaticamente** no modo "Trocar
tudo" — avançar era certo quando uma linha comportava uma resposta só, e
agora impede a segunda. Quem terminou a linha toca em "Próximo item", que é o
que o passo "2 de 5" passa a oferecer.

### Nível 1 — a refeição (`SheetTrocas`)

Cada linha mostra as N trocas empilhadas sob o texto original riscado, ou
"dispensado" em cinza quando for o caso. O `×` da direita continua limpando a
linha inteira.

### O card (`BlocoCard`)

```
sem troca:                Café da Manhã          ~400 kcal
com troca, dentro:        Café da Manhã     380 / ~400 kcal
com troca, estourando:    Café da Manhã     510 / ~400 kcal   (em cor de aviso)
com parcela desconhecida: Café da Manhã    380+ / ~400 kcal
```

"Estourando" é passar da meta da própria refeição. A cor é a de aviso que o
card já usa para bloco atrasado — não a destrutiva: comer mais do que o plano
previa numa refeição é uma informação, não um erro.

---

## 5 · Testes

**Domínio** (`plano-dia.test.ts`)
- `trocasDoItem` devolve as N na ordem de escolha; lista vazia sem troca.
- `itemDispensado` distingue dispensada de intacta de trocada.
- `itensResolvidos`: três trocas numa linha dão três lançáveis; linha
  dispensada não aparece em `lancaveis` nem em `semAlimento`; item trocado
  nunca cai de volta no alimento original.
- `kcalDaRefeicao`: soma trocas, ignora dispensadas, usa o plano nas intactas;
  `incompleto` liga com troca de texto sem kcal.

**Repositório** (`plano.test.ts`)
- Duas chamadas de `adicionarTroca` no mesmo item deixam duas linhas.
- `dispensarItem` apaga as trocas; `adicionarTroca` apaga a dispensa.
- `removerUmaTroca` tira uma e deixa as outras.
- `marcarBloco` lança uma entry por troca.
- A migração: uma tabela no formato antigo com trocas dentro é reconstruída
  sem perder linha nenhuma, e rodar de novo não faz nada.

**Telas**
- `sheet-trocas.test.tsx`: adicionar o segundo alimento à mesma linha; o botão
  vira "Adicionar"; remover um só; dispensar e voltar ao plano; confirmar não
  avança sozinho.
- `bloco-card.test.tsx`: `380 / ~400`, o aviso ao estourar, o `+` do
  incompleto, e `~400` puro sem troca.

---

## Riscos

**A reconstrução da tabela.** É o passo que pode perder dados se estiver
errado, e roda no banco de produção no primeiro `db:setup` depois do deploy.
Mitigações: `db.migrate` (transacional), o teste que reconstrói uma tabela no
formato antigo com linhas dentro e confere a contagem, e o reconhecimento por
`sqlite_master` que torna a repetição inofensiva.

**Duplicata acidental deixa de ser impossível.** Assumido em §1, com a lista
visível e o botão desabilitado como defesa.

**`trocaDoItem` some, e três arquivos a usam.** `bloco-card.tsx`,
`sheet-trocas.tsx` e o próprio `plano-dia.ts`. A quebra é em tempo de
compilação, não em runtime.
