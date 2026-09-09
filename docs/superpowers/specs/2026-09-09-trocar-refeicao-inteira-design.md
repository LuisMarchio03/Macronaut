# Trocar a refeição inteira por uma lista livre — desenho

Hoje toda comida que você registra tem que se pendurar numa **linha** do plano.
Trocar a refeição inteira significa percorrer as linhas uma a uma, e o número
de alimentos que você pode registrar fica preso ao número de linhas que o
nutricionista escreveu. Este desenho dá à refeição um segundo escopo de troca:
uma lista nova, com quantos alimentos você quiser, sem relação nenhuma com as
linhas.

Escopo escolhido pelo usuário: **lista livre no nível da refeição**, **a
refeição apaga as trocas de linha**, e **o percorrer linha a linha continua
existindo** como terceiro caminho.

---

## O problema

**P1 · A troca é sempre de uma linha.**
`plan_item_swaps.item_id` é `NOT NULL`. Não existe jeito de dizer "no lugar do
almoço inteiro, comi isto" — só "no lugar do arroz, comi aquilo", repetido.

**P2 · "Trocar tudo" não substitui a refeição, ele a percorre.**
`sheet-trocas.tsx:496` abre o item 1, oferece "Próximo item", abre o item 2. É
um assistente de troca linha a linha com nome de substituição em bloco. Quem
comeu uma pizza no lugar de um almoço de quatro linhas tem que responder quatro
vezes — e é isso que produz a sensação de que "ele coloca a mesma coisa em cada
item".

**P3 · A lista nova não cabe.**
Três alimentos no lugar de cinco linhas exige pendurar os três em alguma linha
e dispensar as outras quatro. O registro que sai daí é falso: o app passa a
afirmar que a pizza substituiu o arroz, quando ela substituiu o almoço.

Os três têm a mesma origem, e ela foi uma decisão consciente: o desenho de
01/09 (`2026-09-01-troca-multipla-design.md:44`) descartou de propósito "um
botão 'substituir a refeição inteira' com uma lista livre, que resolveria o
caso mas perderia qual item substituiu qual". **A perda é real e agora é
aceita** — quando você troca a refeição toda, não existe "qual item substituiu
qual" para preservar. Só existe o que você comeu.

---

## Decisões

Fechadas com o usuário antes do desenho:

1. **Lista livre no nível da refeição.** `item_id` passa a aceitar `NULL`, e
   `NULL` quer dizer "esta troca substitui o bloco, não uma linha". A
   alternativa descartada era pendurar a lista na primeira linha e dispensar as
   demais, que funcionaria sem tocar no banco e mentiria sobre o que
   substituiu o quê.
2. **A refeição apaga as trocas de linha.** Uma refeição está num modo ou no
   outro: ou você ajusta linha a linha, ou você a substituiu inteira. Somar os
   dois seria "substituir tudo" que na verdade acrescenta — a mesma confusão
   que originou o pedido.
3. **O percorrer fica.** "Trocar tudo" se divide em dois botões: "Linha a
   linha" (o assistente de hoje, intacto) e "Refeição inteira" (a lista nova).

---

## 1 · O esquema

### `item_id` passa a aceitar NULL

A coluna deixa de ser só "qual linha" e passa a dizer também **o escopo da
troca**:

```
item_id = 12     →  troca da LINHA 12   "no lugar dos ovos, comi pão"
item_id = NULL   →  troca da REFEIÇÃO   "no lugar do almoço, comi isto"
```

```sql
-- Antes:
item_id INTEGER NOT NULL,   -- plan_items.id: QUAL linha foi trocada
CHECK (
  (dispensado = 1 AND swap_id IS NULL AND food_id IS NULL AND texto IS NULL)
  OR
  (dispensado = 0
   AND (swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
)

-- Depois:
item_id INTEGER,            -- plan_items.id, ou NULL: a troca é da REFEIÇÃO
CHECK (
  (dispensado = 1 AND item_id IS NOT NULL
   AND swap_id IS NULL AND food_id IS NULL AND texto IS NULL)
  OR
  (dispensado = 0
   AND (swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
)
```

**A dispensa continua sendo só de linha**, e o `CHECK` passa a exigir isso.
"Não comi esta refeição" já tem resposta no app desde sempre: é não marcar
"Comi". Uma dispensa de bloco seria uma segunda maneira de dizer a mesma coisa,
e as duas discordariam no dia em que alguém usasse só uma.

A chave estrangeira de `item_id` fica como está — `ON DELETE CASCADE` não
enxerga linha com `NULL`, e é o `block_id` (também `CASCADE`) que apaga as
trocas da refeição quando o plano é reimportado.

O índice `idx_plan_item_swaps_dispensa` também fica: toda dispensa tem
`item_id`, então ele continua garantindo no máximo uma por linha por dia.

### A migração é a segunda reconstrução da mesma tabela

SQLite não afrouxa `NOT NULL` nem altera `CHECK` com `ALTER TABLE`. A máquina
de `REBUILDS` de `scripts/lib/apply-schema.ts:117` já existe e já reconstruiu
esta tabela uma vez; ganha uma segunda entrada, **depois** da primeira no
array:

```ts
{
  table: "plan_item_swaps",
  obsoleto: /item_id\s+INTEGER\s+NOT\s+NULL/i,
  passos: [ /* CREATE nova, INSERT SELECT, DROP, RENAME, os dois índices */ ],
}
```

A ordem no array é o que faz um banco legado atravessar as duas: `aplicarReconstrucoes`
relê `sqlite_master` a cada entrada, então a primeira tira o `UNIQUE` e produz
uma tabela com `item_id INTEGER NOT NULL` — que é exatamente o que a segunda
reconhece. Um banco já reconstruído duas vezes não casa com nenhuma das duas, e
o `db:setup` seguinte não faz nada.

O `INSERT ... SELECT` copia todas as colunas, `dispensado` inclusive. Nenhuma
troca já gravada muda de sentido: todas tinham `item_id`, e continuam tendo.

Vai por `db.migrate([...])`, como a primeira, pelo mesmo motivo — é o modo do
`@libsql/client` que suspende a checagem de FK durante a troca.

---

## 2 · O domínio

`src/domain/plano-types.ts` e `src/domain/plano-dia.ts`.

### `TrocaDeItem` vira `Troca`

O tipo descreve agora as duas coisas, e o nome antigo passaria a mentir na
metade dos casos. Rename mecânico; `item_id` vira `number | null`, com o
comentário que diz o que `null` significa. `LancamentoDoPlano.item_id` segue
junto — um lançamento vindo da refeição não pertence a linha nenhuma, e o campo
só é usado para ordenar e para os testes, nunca gravado em `food_entries`.

### Duas funções novas

```ts
/** Os alimentos que substituíram a refeição inteira, na ordem em que entraram. */
export function trocasDaRefeicao(trocas: Troca[], blockId: number): Troca[];

/** A refeição foi substituída inteira? */
export function refeicaoSubstituida(trocas: Troca[], blockId: number): boolean;
```

`trocasDoItem` e `itemDispensado` não mudam uma linha: comparam `item_id` com
um número, e `null` nunca é igual a um número. Uma troca da refeição não vaza
para linha nenhuma sem que ninguém precise se lembrar disso.

### `itensResolvidos` vira `refeicaoResolvida` e ganha um curto-circuito

O nome muda porque a função deixa de resolver itens quando a refeição foi
substituída — ali não há item para resolver.

```ts
export function refeicaoResolvida(
  itens: PlanItem[],
  trocas: Troca[],
  blockId: number,
): {
  lancaveis: LancamentoDoPlano[];
  semAlimento: PlanItem[];
  dispensados: PlanItem[];
  /** Trocas da REFEIÇÃO que o app não sabe contar (texto livre sem caloria). */
  naoContadas: Troca[];
};
```

**Refeição substituída ⇒ as linhas do plano não existem.** Nem como lançáveis,
nem como `semAlimento`, nem como `dispensados` — as três saídas vêm vazias, e
`lancaveis` sai da lista nova. Cair de volta nas linhas seria registrar no
diário um almoço que não aconteceu, que é a mesma regra que já vale para uma
linha trocada, um nível acima.

`naoContadas` é o aviso equivalente ao "não entra no balanço" de hoje, para o
escopo da refeição: sem ele, um texto livre sem caloria sumiria do balanço em
silêncio.

`blockId` entra como parâmetro em vez de sair de `itens[0].block_id` porque a
função precisa responder sobre um bloco mesmo quando ele não tem linha nenhuma,
e derivar de um array possivelmente vazio é o tipo de coisa que quebra tarde.

### `kcalDaRefeicao` recebe `blockId`

Mesmo curto-circuito: substituída, soma só a lista nova, e `incompleto` fica
`true` quando alguma parcela dela não tem caloria. O `380+ / ~400` do card
continua exatamente igual na tela, contando outra coisa por baixo.

---

## 3 · O repositório

`src/repositories/plano.ts`. `TrocaEntrada.item_id` vira `number | null`.

```ts
/** Acrescenta um alimento à lista que substitui a REFEIÇÃO inteira. */
adicionarTrocaDaRefeicao(db, userId, e: TrocaEntrada): Promise<void>

/** "Voltar ao plano": apaga os DOIS escopos do bloco no dia. */
limparRefeicao(db, userId, data: string, blockId: number): Promise<void>
```

`adicionarTrocaDaRefeicao` é um `batch` de dois passos:

```sql
DELETE FROM plan_item_swaps
 WHERE user_id=? AND data=? AND block_id=? AND item_id IS NOT NULL;
INSERT INTO plan_item_swaps (… item_id …) VALUES (…, NULL, …);
```

O `DELETE` é a decisão 2 escrita uma vez só. Ele é idempotente na prática:
depois do primeiro alimento não há mais troca de linha naquele bloco para
apagar.

**O caminho inverso não existe de propósito.** Gravar uma troca de linha não
apaga a lista da refeição, porque a folha não deixa tocar numa linha enquanto a
refeição está substituída — você toca "Voltar ao plano" primeiro. Fazer o
`DELETE` simétrico transformaria um toque errado numa linha em perder uma lista
de cinco alimentos sem aviso.

`adicionarTroca`, `salvarTroca`, `dispensarItem` e `removerTroca` ficam como
estão: todas endereçam por `item_id`, que continua sendo um número no escopo
delas. `removerUmaTroca` já apaga por `id` e serve aos dois escopos sem mudar.

As duas operações novas entram no `REGISTRO` (`api/_lib/registro.ts`) com
escopo `usuario` — o `api-escopo.test.ts` falha se ficarem de fora.

---

## 4 · As telas

### A folha ganha um terceiro nível

```
NÍVEL 1 · a refeição            NÍVEL 2 · uma linha       NÍVEL 3 · a refeição
┌────────────────────────┐      (o que existe hoje,       ┌────────────────────────┐
│ Almoço                 │       com "Próximo item")      │ Trocar Almoço          │
│ • Arroz integral    ›  │                                │ Monte o que você comeu │
│ • Frango grelhado   ›  │                                │ ┌────────────────────┐ │
│ • Salada            ›  │                                │ │ Pizza · 3 fat 480 ×│ │
│                        │                                │ │ Refri · 350ml 140 ×│ │
│ [Linha a linha][Refei- │                                │ └────────────────────┘ │
│  ção inteira]          │                                │ 620 kcal · meta ~500   │
│ [        Comi        ] │                                │ (Do plano│Catálogo│    │
└────────────────────────┘                                │           Escrever)    │
                                                          └────────────────────────┘
```

### Nível 3 — `TrocarRefeicao` (novo)

Duas diferenças em relação ao nível 2, e são elas o pedido:

- **Todo confirmar ACRESCENTA, inclusive na aba "Do plano".** No nível da
  linha, escolher uma segunda opção prevista é corrigir a primeira — duas
  substituições para a mesma linha não é o que aquele toque quer dizer. No
  nível da refeição, escolher duas é exatamente o que este quer.
- **"Do plano" mostra todas as substituições do bloco**, com um título por
  categoria (`trocasDoBloco` já devolve o `Map<categoria, PlanSwap[]>`), porque
  não há categoria de linha para filtrar.

Mostra o total corrido contra a meta do bloco (`620 kcal · meta ~500`), com o
`+` de sempre quando alguma escolha não tem caloria. Não tem "Não comi esta
linha" nem "Próximo item": nenhum dos dois quer dizer nada aqui.

### Nível 1 — `SheetTrocas`

Sem substituição, o rodapé passa de um botão a dois, mais o "Comi":

```
[ Linha a linha ]  [ Refeição inteira ]
[             Comi                    ]
```

Com a refeição substituída, o nível 1 troca de cara: as linhas do plano ficam
riscadas em bloco sob "o plano previa", a lista nova aparece com `×` em cada
alimento (remover um não deveria exigir entrar num nível), e o rodapé vira
`[Voltar ao plano] [Adicionar alimento]` + `[Comi]`. As linhas deixam de ser
tocáveis — é o que torna desnecessário o `DELETE` simétrico do §3.

### O card — `BlocoCard`

O mesmo desenho do nível 1 substituído, sem os botões: as linhas riscadas em
bloco e a lista nova em destaque. A caloria já vem pronta de `kcalDaRefeicao`.

### A quebra de `sheet-trocas.tsx`

O arquivo tem 625 linhas e iria a ~900. O formulário das três abas é idêntico
nos níveis 2 e 3 — incluindo a limpeza depois de cada alimento, consertada em
`84945ef`, que é justamente o que faz "adicionar outro" funcionar. Duplicá-lo
seria duplicar esse conserto e perdê-lo na próxima vez.

```
plano/sheet-trocas.tsx        nível 1
plano/trocar-item.tsx         nível 2 — recorte do que já existe, sem mudança
plano/trocar-refeicao.tsx     nível 3 — novo
plano/escolher-alimento.tsx   as três abas, compartilhadas
```

`EscolherAlimento` recebe as opções do plano já agrupadas —
`{ categoria: string | null; opcoes: PlanSwap[] }[]` — em vez de um booleano
"agrupa ou não": o nível 2 passa um grupo com `categoria: null` (sem título) e
o nível 3 passa N. Assim o componente desenha o que recebe, sem saber de qual
nível veio.

---

## 5 · Testes

**`plano-dia.test.ts`** — `trocasDaRefeicao` e `refeicaoSubstituida` filtram por
bloco e ignoram as trocas de linha; `refeicaoResolvida` com refeição
substituída devolve `semAlimento`/`dispensados` vazios mesmo com linhas que
resolveriam; `naoContadas` traz o texto livre sem caloria; `kcalDaRefeicao`
soma só a lista nova e marca `incompleto`.

**`apply-schema.test.ts`** — a segunda reconstrução reconhece um DDL com
`item_id INTEGER NOT NULL`, copia as linhas existentes, aceita um `INSERT` com
`item_id NULL` depois, recusa uma dispensa sem `item_id`, e rodar de novo não
faz nada. Um banco no formato mais antigo (com `UNIQUE`) atravessa as duas
reconstruções em sequência.

**`sheet-trocas.test.tsx`** — "Refeição inteira" abre o nível 3; dois alimentos
da aba "Do plano" acumulam em vez de substituir; gravar o primeiro apaga a
troca de linha que existia; com a refeição substituída as linhas não são
tocáveis e "Voltar ao plano" as devolve.

**`bloco-card.test.tsx`** — o card desenha a lista nova sobre as linhas
riscadas e mostra a caloria dela.

---

## Riscos

**A reconstrução apaga uma tabela.** É o mesmo risco de 01/09, com a mesma
mitigação: o reconhecimento por regex sobre o DDL guardado, que faz o passo não
rodar num banco que não é o formato antigo. O que muda é que agora são duas
entradas em sequência, e o teste precisa cobrir o banco mais antigo
atravessando as duas.

**Duas telas que ficam parecidas mas não são a mesma.** Nível 2 substitui na
aba "Do plano", nível 3 acrescenta. Se o verbo do botão não disser isso em cada
uma ("Trocar por X" contra "Adicionar X"), o desenho recria em outro lugar
exatamente a confusão que ele veio resolver.
