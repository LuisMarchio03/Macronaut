# A sessão de treino como objeto vivo — desenho

Hoje um treino nasce já dentro do histórico e some da tela na virada do dia.
Este desenho dá à sessão um ciclo de vida explícito — **rascunho → em
andamento → concluído** — e um lugar onde ela é visível enquanto acontece.

Escopo escolhido pelo usuário: **completo**, com as três decisões de produto
fechadas antes de começar (ver "Decisões", abaixo).

---

## O problema, em três furos

**F1 · A sessão entra no histórico no instante em que nasce.**
`workouts.listSessions` (o card "Últimas sessões" do hub) e
`progresso.sessoesComResumo` (a aba Progresso e a consistência) selecionam
`FROM workout_sessions` sem nenhum filtro por `concluida_em`. Tocar em
"Começar treino" e sair da tela põe o treino em curso no meio dos treinos
passados — que é a queixa que abriu este trabalho.

**F2 · O treino aberto ontem desaparece hoje.**
`sessao.sessoesEmAndamento(data)` filtra `s.data = ?`, e o hub sempre passa
`hoje()`. Um treino começado às 22h e não finalizado deixa de existir para o
app na virada da meia-noite: não dá para retomar, não dá para finalizar, e ele
fica para sempre no histórico como uma sessão fantasma sem fim.

**F3 · Não existe lugar nenhum que diga "está acontecendo agora".**
O único sinal é um card dentro da aba "Hoje" do treino. Sair para a Nutrição,
para o Dashboard ou fechar o app significa perder o treino de vista, sem tempo
decorrido e sem caminho de volta.

E, atrás dos três, a causa comum: **o app não distingue "criada" de
"começada"**. Só existe `concluida_em`. "Iniciar" e "criar" são o mesmo evento,
então não há como oferecer um botão "Iniciar treino" que signifique alguma
coisa — nem no avulso, nem na rotina.

---

## Decisões

Fechadas com o usuário antes do desenho:

1. **Três estados**, com um passo de rascunho. O avulso nasce sem ter
   começado: você dá o nome, monta os exercícios, e só então toca "Iniciar
   treino". A rotina segue o mesmo caminho, para não existirem duas semânticas
   de "começar".
2. **Faixa fixa no app inteiro**, acima da barra de navegação, mais o card de
   treinos abertos no hub. (A alternativa descartada era uma aba "Ativos"
   dentro de `/treino`, que não acompanharia o usuário nas outras seções.)
3. **Nada fecha sozinho.** Um treino iniciado e esquecido continua aberto até
   você finalizar ou descartar, marcado com quando começou. Sem encerramento
   automático por tempo e sem diálogo de abertura.

---

## 1 · O modelo de estado

`workout_sessions` ganha **uma coluna**:

```sql
ALTER TABLE workout_sessions ADD COLUMN iniciado_em TEXT
```

Dois campos passam a codificar três estados:

| Estado           | `iniciado_em` | `concluida_em` | Onde aparece                        |
| ---------------- | ------------- | -------------- | ----------------------------------- |
| **Rascunho**     | NULL          | NULL           | só no card "Treinos abertos" do hub |
| **Em andamento** | preenchido    | NULL           | faixa fixa + card do hub            |
| **Concluído**    | preenchido    | preenchido     | histórico, progresso, análise       |

O quarto cruzamento — `concluida_em` preenchido com `iniciado_em` nulo — é
**impossível por construção**: `finalizarSessao` preenche os dois (ver §2). O
domínio ainda assim o trata, classificando-o como concluído, porque uma linha
vinda de um banco mais velho que este código não deve derrubar a tela.

### O predicado mora no domínio

`src/domain/sessao-estado.ts` (novo):

```ts
export type EstadoSessao = "rascunho" | "andamento" | "concluida";

export function estadoDaSessao(s: {
  iniciado_em: string | null;
  concluida_em: string | null;
}): EstadoSessao;
```

Puro e testado nos quatro cruzamentos. Existe para que nenhuma tela
reimplemente a regra com um `!= null` solto — foi assim que `concluida_em`
acabou consultado em quatro arquivos com três leituras diferentes do que ele
significa.

### Migração: o backfill não é opcional

A coluna entra em `scripts/lib/apply-schema.ts`, ao lado das outras, **e vem
acompanhada de um backfill**:

```sql
UPDATE workout_sessions SET iniciado_em = created_at WHERE iniciado_em IS NULL
```

Sem ele, toda sessão já existente teria `iniciado_em` NULL e seria classificada
como rascunho — o histórico inteiro sumiria da aba Progresso, da consistência e
da análise no primeiro deploy. `created_at` é a resposta certa porque no modelo
antigo criar *era* iniciar: a coluna nova só registra o que sempre foi verdade.

Rascunho, portanto, é um estado que **só existe daqui para frente**.

`src/db/schema.sql` ganha a coluna na definição da tabela, para um banco novo
nascer com ela.

---

## 2 · As transições

Em `src/repositories/sessao.ts`.

### `criarSessao({ data, nome, itens }) → id`

É o corpo do `iniciarSessao` atual — cria a linha e escreve o plano — mas a
sessão nasce **rascunho**: `iniciado_em` fica NULL. Serve rotina e avulso pelo
mesmo caminho; a única diferença entre eles continua sendo se `itens` vem cheio
ou vazio.

### `iniciarSessao(sessionId)`

Muda de assinatura. Passa a ser a transição rascunho → andamento:

```sql
UPDATE workout_sessions SET iniciado_em = ?
 WHERE id = ? AND user_id = ? AND iniciado_em IS NULL
```

Idempotente pela mesma razão que `finalizarSessao` é: reiniciar não pode mover
o começo do treino para frente. O `user_id` no `WHERE` é o que impede iniciar a
sessão de outra pessoa.

### `finalizarSessao(sessionId)`

Como hoje, mais uma garantia: **preenche `iniciado_em` também, se estiver
NULL**, no mesmo `UPDATE`. Na prática o botão "Finalizar" só aparece em sessão
já iniciada, mas o repositório não deve ser capaz de produzir um "concluído sem
começo" — e o dia em que alguém finalizar um rascunho direto da lista, o
modelo continua íntegro.

```sql
UPDATE workout_sessions
   SET concluida_em = ?,
       iniciado_em  = COALESCE(iniciado_em, ?)
 WHERE id = ? AND user_id = ? AND concluida_em IS NULL
```

### Auto-início ao registrar

`registrarSerie` e `registrarCardio` preenchem `iniciado_em` se estiver NULL,
no mesmo `batch` em que gravam o realizado.

Se você marcou uma série como feita, o treino começou. Exigir que você tenha
tocado em "Iniciar" antes transformaria um passo de conveniência numa
armadilha: o treino aconteceria sem nunca aparecer na faixa, e a duração
começaria a contar do nada. Esta é a razão de o rascunho ser seguro de
introduzir.

### Descartar

Sem função nova: **`workouts.deleteSession` já faz exatamente isto** — apaga a
sessão, as linhas de plano, as séries e o cardio de `activity_sessions`, nessa
ordem. O que falta é a UI chamá-la. Ela já está no `REGISTRO` do RPC.

---

## 3 · As leituras

### `sessoesEmAndamento(data)` → `sessoesAbertas()`

O filtro por data sai. É a correção de **F2**:

```sql
SELECT s.id, s.nome, s.data, s.iniciado_em, s.created_at,
       COUNT(p.id) AS total,
       SUM(CASE WHEN p.set_id IS NOT NULL OR p.activity_id IS NOT NULL
                THEN 1 ELSE 0 END) AS feitas
  FROM workout_sessions s
  LEFT JOIN session_plan_sets p ON p.session_id = s.id
 WHERE s.user_id = ? AND s.concluida_em IS NULL
 GROUP BY s.id
 ORDER BY s.created_at DESC, s.id DESC
```

O `LEFT JOIN` e a ausência de `LIMIT 1` continuam pelas razões já documentadas
no arquivo (sessão sem plano é como o avulso nasce; treinar duas vezes no mesmo
dia acontece). O que muda é o alcance — **todos os dias** — e o retorno, que
agora carrega `data` e `iniciado_em`: a faixa precisa do segundo para o tempo
decorrido, e o card precisa do primeiro para dizer "de ontem".

`SessaoAberta` ganha os dois campos. `sessaoEmAndamento(data)` — o atalho de
quem só precisa de uma — passa a ser `sessaoAtiva()`, sobre a mesma lista,
devolvendo a primeira **em andamento** (ignorando rascunhos): é o que o
Dashboard consome, e um rascunho não é um treino acontecendo.

### O histórico passa a exigir conclusão

Correção de **F1**. Três consultas ganham `AND s.concluida_em IS NOT NULL`:

| Consulta                            | Quem consome                                             |
| ----------------------------------- | -------------------------------------------------------- |
| `workouts.listSessions`             | card "Últimas sessões" do hub (`treino.tsx:68`)           |
| `progresso.sessoesComResumo`        | aba Progresso → Sessões, e a consistência (`:52`, `:168`) |
| `workouts.listSessionsByRange`      | `nSessoes` da análise de treino                           |

**Consequência assumida:** um treino não finalizado deixa de contar na
consistência semanal e no total da análise. É a leitura correta — o estado
vazio da própria aba já promete "os treinos que você **concluir** aparecem
aqui" — e é o que torna a contagem honesta, já que hoje um rascunho de dez
segundos conta como treino feito.

`workouts.getSessionByDate` **não** ganha o filtro: ela responde "existe sessão
neste dia", e quem a consome (o Dashboard) já cruza com `sessaoAtiva()` para
decidir o que mostrar.

### Uma correção pontual que o filtro exige

`treino-sessao-detalhe.tsx:136` encontra a sessão que está exibindo com
`sessoes.find((s) => s.id === sessionId)` sobre a lista de 200 do histórico.
Com o filtro por conclusão, abrir o detalhe de uma sessão aberta perderia o
cabeçalho inteiro.

A troca é por `useSessao(sessionId)`, que já existe, busca por id e não depende
de a sessão estar num recorte de lista. Isso remove uma consulta de 200 linhas
de uma tela que precisava de uma.

---

## 4 · A tela da academia

`src/pages/treino-sessao.tsx`. O rodapé deixa de ser sempre "Finalizar" e passa
a ser função do estado:

| Estado           | Rodapé                                                        |
| ---------------- | ------------------------------------------------------------- |
| **Rascunho**     | `▶ Iniciar treino` (primário) + `Descartar` (texto, confirmado) |
| **Em andamento** | `■ Finalizar treino` / `Finalizar (4 de 12)` — como hoje       |
| **Concluído**    | sem ação: "Concluído às 19:32" + `Ver no histórico`            |

O terceiro caso é um bug de hoje: abrir `?s=` de uma sessão já fechada continua
oferecendo "Finalizar", que é inócuo por idempotência mas mente sobre o estado.

`Descartar` passa pelo `Confirmar` que o projeto já tem (`components/ui/confirmar.tsx`),
com o texto dizendo o que se perde. Descartar é destrutivo e não tem desfazer.

O cabeçalho ganha o tempo decorrido quando em andamento, ao lado do nome.

---

## 5 · A faixa fixa

`src/components/faixa-treino-ativo.tsx` (novo), montada no `ProtectedLayout` de
`App.tsx`, imediatamente acima do `BottomNav`.

- **Aparece** só quando há ao menos uma sessão **em andamento** (rascunho não
  aparece: não está acontecendo).
- **Não aparece** em `/treino/sessao` — a rota já está fora do
  `ProtectedLayout`, então isso sai de graça e é a razão de montá-la ali.
- **Mostra** nome, tempo decorrido correndo, e `4 de 12 séries`. Com duas
  sessões abertas, a mais recente e um `+1`.
- **Toque** leva a `/treino/sessao?s=<id>`.

O padding inferior do `ProtectedLayout` cresce quando ela existe. Hoje já são
dois valores condicionais ali (com e sem o botão de registro rápido); passam a
ser quatro combinações, o que pede extrair o cálculo para uma constante em vez
de um ternário aninhado.

### O tempo decorrido não usa `localStorage`

`useTempoDecorrido(iso)` (novo, em `src/hooks/`) calcula `agora − iniciado_em` e
tica a cada segundo. Nada é persistido: o relógio de parede é a fonte, então
fechar o app e voltar duas horas depois dá o número certo sem nenhum estado
salvo. É o mesmo princípio do `fimTs` do `CronometroDescanso`, sem precisar do
`localStorage` que ele usa — aquele precisa porque o alvo é uma escolha do
usuário; este deriva de uma coluna do banco.

O intervalo é limpo no unmount, e para de ticar quando não há sessão ativa.

---

## 6 · O hub e a entrada dos treinos

### O card de treinos abertos (`src/pages/treino.tsx`)

O bloco que hoje mapeia `abertas` vira a lista completa, ordenada com **em
andamento primeiro, rascunhos depois**. Cada linha traz nome, estado, quando
começou e o progresso:

```
● Peito e Tríceps          em andamento
  iniciado ontem às 22:14 · 14 h atrás · 4 de 12 séries
  [ Retomar ]              [ Finalizar ]

○ Treino avulso            não iniciado
  criado hoje às 07:02 · sem exercício ainda
  [ Continuar montando ]   [ Descartar ]
```

É esta lista — e não uma aba nova — o "lugar para ver os treinos ativos",
porque a faixa já resolve a visibilidade fora do treino. Nada fecha sozinho: um
treino de três dias atrás continua nesta lista até você decidir.

### A entrada muda de significado

- **`SheetTreinoAvulso`**: o botão passa de "Começar" para **"Criar"**, e a
  descrição diz que os exercícios entram depois. Ele cria o rascunho e navega.
- **"Começar treino" da rotina**: mesmo caminho — `criarSessao` com o plano do
  dia, navega para a tela, e lá você toca "Iniciar treino". Não sobra nenhum
  caminho que crie uma sessão já iniciada.

---

## 7 · Superfície do RPC

`api/_lib/registro.ts` acompanha as renomeações — o registro é uma lista
explícita, então uma função que muda de nome sem passar por ali simplesmente
para de existir para o cliente:

| Entrada                       | Mudança                                   |
| ----------------------------- | ----------------------------------------- |
| `sessao.iniciarSessao`        | mantém o nome, muda o argumento           |
| `sessao.criarSessao`          | **nova**                                  |
| `sessao.sessoesAbertas`       | **nova** (substitui `sessoesEmAndamento`) |
| `sessao.sessaoAtiva`          | **nova** (substitui `sessaoEmAndamento`)  |
| `sessao.sessoesEmAndamento`   | sai                                       |
| `sessao.sessaoEmAndamento`    | sai                                       |
| `workouts.deleteSession`      | já registrada; passa a ser usada no treino |

---

## 8 · Testes

Na ordem do TDD — cada camada só depois de a anterior estar verde.

**Domínio** (`src/domain/sessao-estado.test.ts`)
Os quatro cruzamentos de `estadoDaSessao`, incluindo o impossível.

**Repositório** (`src/repositories/sessao.test.ts`, `workouts.test.ts`, `progresso.test.ts`)
- Um rascunho não aparece em `listSessions`, `sessoesComResumo` nem `listSessionsByRange`.
- Um rascunho aparece em `sessoesAbertas`; uma sessão em andamento **de ontem**
  também (a regressão de F2, presa por um teste).
- `iniciarSessao` é idempotente: chamar duas vezes não move `iniciado_em`.
- `registrarSerie` e `registrarCardio` num rascunho preenchem `iniciado_em`.
- `finalizarSessao` num rascunho preenche os dois campos.
- `sessaoAtiva` ignora rascunhos.
- `deleteSession` leva plano, séries e cardio junto (já coberto; confirmar).

**Migração** (`scripts/lib/`)
O backfill marca como iniciada toda sessão pré-existente — incluindo as já
concluídas, que continuam no histórico.

**Telas**
- `treino.test.tsx`: criar um avulso **não** cria linha em "Últimas sessões";
  a lista de abertos mostra rascunho e andamento com as ações certas.
- `treino-sessao.test.tsx`: o rodapé muda com o estado; "Iniciar treino" grava
  `iniciado_em`; descartar apaga e volta ao hub.
- `faixa-treino-ativo.test.tsx` (novo): aparece com sessão em andamento, some
  sem nenhuma, ignora rascunho, e mostra o `+1` com duas.

---

## Riscos

**`iniciarSessao` muda de contrato.** De `{data, nome, itens}` para
`sessionId`. Os testes existentes que dependem dela criar uma sessão já
iniciada vão quebrar — são o alvo do TDD, não dano colateral, e a quebra é em
tempo de compilação, não em runtime.

**Produção roda `redesign-plano`, 25 commits atrás da `main`.** Este trabalho
sai de `main`, numa branch própria. Subir para produção é decisão à parte e
está fora deste desenho — mas vale registrar que o backfill de §1 é o passo que
não pode ser pulado quando ele for.

**Rascunho é lixo em potencial.** Uma sessão criada e abandonada fica na lista
para sempre, por decisão explícita do usuário (§ Decisões, 3). O card do hub é
o que a mantém visível e descartável; se o acúmulo incomodar na prática, a
resposta é uma limpeza oferecida na própria lista, não um encerramento
automático.
