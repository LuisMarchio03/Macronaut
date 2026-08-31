# Trocas por item, treino avulso e cronômetro — desenho

Corrige os achados de `achados-teste-manual-2026-08-31.md`. Três frentes
independentes, que compartilham só o repositório.

Escopo escolhido pelo usuário: **completo** nas três.

---

## 1 · Substituições: de uma troca por refeição para uma troca por item

### O problema, em uma frase

`plan_checks.swap_id` é uma coluna só. Toda a experiência de trocar deriva
dessa limitação: escolher uma opção grava a única troca que cabe e fecha a
refeição (S1), o botão some (S2), e nada disso aparece de volta na tela (S4).

### O modelo novo

Uma tabela nova, uma linha por **item** trocado por dia:

```sql
CREATE TABLE IF NOT EXISTS plan_item_swaps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  data       TEXT    NOT NULL,          -- 'YYYY-MM-DD'
  block_id   INTEGER NOT NULL,
  item_id    INTEGER NOT NULL,          -- plan_items.id — QUAL linha foi trocada

  -- A origem da troca. Exatamente uma das três é preenchida.
  swap_id    INTEGER,                   -- plan_swaps.id  → prevista no plano
  food_id    INTEGER,                   -- foods.id       → alimento do catálogo
  texto      TEXT,                      -- o que você escreveu

  qty_g      REAL,                      -- quando veio do catálogo
  measure_id INTEGER,                   -- food_measures.id, quando escolhida
  medidas    REAL,                      -- quantas medidas caseiras
  kcal       REAL,                      -- NULL = desconhecida, e a tela diz isso
  created_at TEXT NOT NULL,

  -- Uma troca por item por dia; trocar de novo é atualizar.
  UNIQUE (user_id, data, item_id),
  FOREIGN KEY (block_id)   REFERENCES plan_blocks (id)   ON DELETE CASCADE,
  FOREIGN KEY (item_id)    REFERENCES plan_items (id)    ON DELETE CASCADE,
  FOREIGN KEY (swap_id)    REFERENCES plan_swaps (id)    ON DELETE SET NULL,
  FOREIGN KEY (food_id)    REFERENCES foods (id)         ON DELETE SET NULL,
  FOREIGN KEY (measure_id) REFERENCES food_measures (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_item_swaps_dia
  ON plan_item_swaps (user_id, data);
```

`UNIQUE (user_id, data, item_id)` é o que faz o upsert funcionar e o que
garante que "trocar de novo" corrige em vez de acumular — a mesma regra que
`plan_checks` já usa por bloco.

**Migração do legado.** `plan_checks.swap_id` não-nulo vira uma linha em
`plan_item_swaps`, casada com o primeiro item do bloco cuja categoria bate com
a do swap. Sem casamento, a linha antiga é ignorada — nada é perdido porque a
coluna continua no banco. Roda em `scripts/setup-db.ts`, ao lado das outras
migrações, e é contada no relatório final como as demais.

A coluna `plan_checks.swap_id` deixa de ser escrita e lida. Fica como
sedimento; removê-la exigiria recriar a tabela em SQLite e não paga.

### A folha, em dois níveis

Hoje `SheetTrocas` é "a lista de trocas do bloco". Passa a ser **a refeição de
hoje** — e é dela que se chega às trocas.

**Nível 1 — a refeição:**

```
Café da Manhã                                   7h – 8h
────────────────────────────────────────────────────────
 Proteína     3 ovos mexidos com espinafre           ›
 Carboidrato  1 fatia de pão integral                ›
              ↳ Tapioca · 2 col. sopa (30g) · 90 kcal ✕
 Fruta        1 fruta média (maçã ou mamão)          ›
 Gordura      1 col. chá pasta de amendoim           ›
 —            Café preto sem açúcar                  ›
────────────────────────────────────────────────────────
        [ Trocar tudo ]            [ Comi ]
```

Cada linha é um alvo de toque. A troca aparece embaixo do item original, com
um `✕` que a desfaz. **"Trocar tudo"** percorre os itens em sequência — abre o
nível 2 do primeiro, e ao confirmar avança para o próximo, com "pular" em cada
um. É a resposta literal a "não consigo substituir toda a refeição".

**Nível 2 — o item:**

```
←  Trocar "1 fatia de pão integral"
   [ Do plano ]  [ Catálogo ]  [ Escrever ]

   Do plano · Carboidrato
     Pão integral        1 fatia (30g)      75 kcal
     Tapioca             2 col. sopa (30g)  90 kcal
     Aveia em flocos     3 col. sopa (30g) 110 kcal
```

- **Do plano** — `trocasPara(swaps, bloco, categoria)`, a função que já existe
  e nunca foi chamada (S6). Item sem categoria mostra todas as trocas do bloco.
- **Catálogo** — o mesmo tijolo do diário: `TacoAutocomplete` +
  `useFoodMeasures`, com medida caseira e quantidade; a kcal sai da conta, não
  de um chute.
- **Escrever** — texto livre e kcal opcional, para o que não está em catálogo
  nenhum. Sem kcal, a troca é descritiva e a tela **diz** que ela não entra no
  balanço.

### Onde o botão passa a viver

- Em **todo bloco de refeição ou suplemento que tenha itens** — aberto ou
  fechado, marcado ou não (corrige S2 e S3).
- No card fechado, um segundo alvo redondo de 44px ao lado do check.
- O `BlocoCard` recebe as trocas do dia e desenha o item trocado com o original
  riscado e a troca embaixo (corrige S4).

### "Comi" passa a gravar no diário

É o que o comentário de `plan_items` promete desde sempre (S7), e é o que faz
a troca valer caloria.

Marcar um bloco como feito grava um `food_entries` para cada item que **resolve
para um alimento de verdade**, nesta ordem de precedência:

1. a troca do dia, quando tem `food_id` (do catálogo, ou do `plan_swaps.food_id`);
2. o próprio item, quando tem `plan_items.food_id` + `qty_g`;
3. nada — e a folha marca a linha com "não entra no balanço", com o caminho de
   conserto a um toque de distância (é o mesmo "Trocar › Catálogo").

Nenhum número é inventado. Item sem alimento casado simplesmente não é
contado, e a tela é explícita sobre isso.

**Desmarcar apaga o que aquele bloco lançou naquele dia.** Para isso
`food_entries` ganha uma coluna nova:

```sql
ALTER TABLE food_entries ADD COLUMN plan_block_id INTEGER;   -- via migração idempotente
CREATE INDEX IF NOT EXISTS idx_entries_plan_block
  ON food_entries (user_id, data, plan_block_id);
```

Sem ela, desmarcar teria que adivinhar quais lançamentos vieram do plano e
quais você digitou à mão.

**Bloco → refeição do diário:** casamento pelo nome normalizado (`Café da
Manhã` → a refeição de mesmo nome). Sem casamento, a refeição é criada uma vez,
com o nome do bloco e o `hora_inicio` como horário — o que torna a operação
idempotente da segunda vez em diante.

### Domínio

Entra em `src/domain/plano-dia.ts`, puro e testado:

- `trocaDoItem(trocas, itemId)` — a troca vigente de um item.
- `descreverTroca(troca)` — o texto que a tela mostra.
- `itensResolvidos(itens, trocas)` — o que "Comi" vai lançar, e o que ficou de
  fora por não ter alimento casado.

---

## 2 · Treino avulso: mais de um por dia, e nenhum órfão

### `sessaoEmAndamento` → `sessoesEmAndamento`

Duas mudanças na consulta (`repositories/sessao.ts:401`):

- `JOIN` vira **`LEFT JOIN`** — sessão sem plano passa a existir (corrige T1).
- Devolve **todas** as sessões abertas do dia, não `LIMIT 1`.

`total` e `feitas` viram 0 numa sessão vazia, e a tela sabe dizer "sem
exercício ainda" em vez de sumir.

O hub lista cada sessão aberta com o seu "Retomar". `/treino/sessao` sem `?s=`
continua abrindo a mais recente.

### Um caminho para o treino avulso, todo dia

`pages/treino.tsx` ganha uma ação **"Treino avulso"** sempre presente, ao lado
do que já existe (corrige T2):

- dia com rotina → botão secundário abaixo de "Começar treino";
- dia de descanso → substitui "Treinar mesmo assim", com o mesmo lugar na tela;
- com sessão aberta → continua disponível, porque treinar duas vezes no mesmo
  dia é uma coisa que acontece.

Ele abre uma folha curta pedindo o **nome** (padrão "Treino avulso"), para dois
avulsos no mesmo dia não serem duas linhas idênticas na lista.

### Adicionar exercício a um treino já criado

`pages/treino-sessao-detalhe.tsx` ganha o mesmo bloco tracejado de
"Adicionar exercício" que a sessão em andamento já tem — `ExercicioAutocomplete`
+ `useAdicionarAoPlano` (corrige T3). Vale também no estado vazio: onde hoje só
há "Excluir esta sessão", passa a haver o adicionador, e a sessão de T1 deixa de
ser um beco sem saída.

### Cardio na rotina nasce cardio

`pages/treino-rotina.tsx` troca a constante `PADRAO` por uma função do
exercício escolhido (corrige T7):

```ts
function padraoDe(e: Exercise): Omit<ExercicioRotinaInput, "exercise_id">
```

`equipamento === "cardio"` → `{ prescricao: "cardio", duracao_min: 30, series: 1 }`;
o resto continua a dupla progressão de hoje. É a mesma regra que
`montarItemAvulso` já usa — passa a haver uma só.

### `criarRotina` desativa as anteriores

Um `db.batch` com o `UPDATE … SET ativa=0 WHERE user_id=?` antes do `INSERT`,
igual ao que `ativarPlano` faz (corrige T8).

---

## 3 · Cronômetro entre séries

### A guarda que trava o primeiro descanso

`chave` passa a valer **0 = ocioso**, e o efeito sai cedo só nesse caso:

```ts
useEffect(() => {
  if (chave === 0) return;      // ninguém registrou série ainda
  setRestante(segundos);
  setRodando(true);
}, [chave, segundos]);
```

O `useRef` `primeira` some. A diferença é que o critério passa a ser um dado
("houve série?") e não a ordem em que o React chamou o efeito — que é
justamente o que muda entre dev e produção (corrige T4).

### Sempre na tela

O cronômetro deixa de ser condicionado a `registros > 0` e fica montado durante
a sessão inteira, ocioso até a primeira série. Ocioso ele mostra o descanso do
exercício atual e um play — dá para cronometrar um aquecimento (corrige T6).

### Sobrevive a fechar o app

O estado vai para `localStorage` sob `macronaut.descanso`, por sessão:

```ts
type DescansoSalvo = { sessionId: number; alvo_s: number; fim_ts: number; rodando: boolean };
```

Guardar **`fim_ts` (relógio de parede)** e não o restante é o que faz a conta
continuar certa com o app fechado — voltar depois de três minutos mostra
`+0:30`, não `2:30` (corrige T5). Pausado, guarda o restante.

### Avisa quando zera

Ao cruzar o zero, uma vez por descanso:

- `navigator.vibrate([200, 100, 200])`, dentro de `try/catch` — nem todo
  navegador tem, e nenhum tem em iOS;
- um bipe curto via `AudioContext`, criado no primeiro toque do usuário (sem
  gesto, o navegador bloqueia e o áudio nunca sai);
- um botão de silenciar, com a escolha guardada.

Sem promessa de notificação em segundo plano: o app não roda lá, e prometer um
alarme que não toca é pior do que não prometer — a linha que o componente já
diz hoje continua verdadeira.

### Ajuste no lugar e tempo total

- `−15s` / `+15s` no próprio cronômetro; o valor ajustado vale para o exercício
  atual pelo resto da sessão.
- O cabeçalho da sessão ganha o **tempo decorrido** desde `workout_sessions.created_at`,
  ao lado de `feitas/total`.

---

## Testes

A suíte é a rede de segurança e o baseline é **1087 testes em 125 arquivos,
verde**. Cada correção entra com o teste que falha antes dela:

| Frente | O que o teste prende |
|---|---|
| Domínio das trocas | `trocaDoItem`, `descreverTroca`, `itensResolvidos` — puro |
| `plan_item_swaps` | upsert por `(user_id, data, item_id)`, as três origens, migração do `plan_checks.swap_id` |
| "Comi" | grava entries do que resolve, ignora o que não resolve, e desmarcar apaga só o que aquele bloco lançou |
| `SheetTrocas` | dois níveis, "Trocar tudo" percorre os itens, `✕` desfaz |
| `BlocoCard` | "Trocar" aparece marcado/desmarcado, aberto/fechado; o item trocado aparece riscado |
| `sessoesEmAndamento` | sessão sem plano aparece; várias abertas no mesmo dia aparecem |
| Detalhe da sessão | adicionar exercício numa sessão criada, inclusive vazia |
| `padraoDe` | cardio do catálogo vira prescrição de cardio |
| `criarRotina` | criar a segunda desativa a primeira |
| `CronometroDescanso` | `chave=0` não roda; `chave=1` roda no mount; restaura de `localStorage` pelo relógio de parede; avisa uma vez só |

Fecha com a mesma varredura de navegador que produziu os achados, **duas
vezes**: uma contra o dev server e uma contra o **build de produção**
(`npm run build && npm run preview`) — T4 só é visível na segunda, porque em
desenvolvimento o StrictMode o esconde.
