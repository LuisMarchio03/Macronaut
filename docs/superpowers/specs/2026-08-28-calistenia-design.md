# Calistenia — o treino que acontece fora da sessão

**Data:** 2026-08-28
**Status:** desenho aprovado, aguardando plano de implementação

---

## O problema

O app sabe registrar duas coisas: uma **sessão de treino** (você abre, executa
uma lista ordenada, fecha) e uma **atividade de cardio** (duração e MET). O que
ele não sabe registrar é o terceiro modo, que é o que mais acontece:

> "Às vezes, em horários aleatórios do dia, faço algumas flexões, abdominais,
> agachamentos e outras coisas. Sem método, só faço aleatórios. Quero algo que
> adicione isso também como algo que eu faço na minha rotina."

Vinte flexões às 10h, mais vinte às 15h, trinta agachamentos antes do banho.
Hoje isso não existe em lugar nenhum do Macronaut: não é sessão (não tem
começo, meio e fim), não é cardio (não tem duração contínua), e forçar numa
sessão-fantasma por dia estragaria o histórico de treino de verdade.

O pedido tem duas metades, e a segunda é a difícil:

1. **Registrar** — em dois toques, de qualquer tela, sem cerimônia.
2. **Medir se está ajudando** — porque "sem método" não pode significar "sem
   resposta". A pergunta é se esse esforço solto está contribuindo para o
   objetivo, e ela precisa de número.

---

## Decisões

### D1 · Tabela própria, não `workout_sets`

Uma série avulsa **não** vira linha em `workout_sets`. Aquela tabela exige
`session_id NOT NULL`, e criar uma sessão-fantasma por dia teria quatro
consequências, todas silenciosas:

- `listSessions` e `sessoesComResumo` passariam a listar "sessões" de 20
  flexões ao lado de treinos de uma hora.
- `ultimaVezExercicio` — que decide a **carga de hoje** na dupla progressão —
  leria séries de peso corporal a 0 kg e rebaixaria a prescrição do exercício.
- `treinosPorSemana` (consistência) contaria o dia como dia treinado (ver D4).
- O volume em kg da `/analise` ganharia zeros que diluem a média.

Tabela separada custa algumas funções de leitura a mais e não custa nenhuma
dessas quatro correções tardias.

### D2 · Reaproveita o catálogo de `exercises`

Flexão de braço é a mesma flexão que já está no catálogo, com grupo muscular,
músculos secundários, apelidos, execução e mapa muscular. `calistenia_sets`
referencia `exercises.id` — nenhum catálogo paralelo.

Duas colunas entram no catálogo para servir a este módulo:

- **`fracao_corporal`** (nova, aditiva): que fração do peso do corpo o
  movimento levanta. Flexão ≈ 0,64; barra fixa ≈ 1,00; abdominal supra ≈ 0,35.
  É o que permite converter "40 flexões" em volume comparável a "40 kg × 10".
- **`met`** (já existe, hoje só preenchida em cardio): passa a ser semeada
  também nos exercícios de peso corporal, para a estimativa de caloria.

Semear `met` em exercício de peso corporal é **seguro**: cardio é reconhecido
por `equipamento = 'cardio'` (em `montarItemAvulso`) e por `duracao_min IS NOT
NULL` (em `ehCardio`) — nunca pela presença de MET. Uma flexão com MET não vira
bicicleta na sessão.

### D3 · Repetições **ou** segundos, nunca os dois

Flexão se conta em repetições; prancha se conta em segundos. A tabela aceita as
duas medidas com um `CHECK` que exige exatamente uma preenchida — a alternativa
(converter prancha em "reps") mentiria no número que o usuário digitou.

### D4 · Não conta como dia treinado na consistência da rotina

`treinosPorSemana` e `estadoDosDias` continuam medindo **só** as sessões. Um
dia de 40 flexões não é o dia de perna que você está pulando há 11 dias, e
deixá-lo mascarar isso destruiria o único número que hoje denuncia o dia
pulado.

A calistenia tem a **própria sequência de dias** e a própria média — que é o
número honesto para ela, e o que dá a sensação de "estou mantendo".

### D5 · A caloria entra no balanço energético, calculada na leitura

A kcal da calistenia soma ao gasto do dia na `/analise`, ao lado do cardio —
é por aí que "está ajudando no meu objetivo" vira resposta.

Ela **não** é gravada em `activity_sessions`. Vinte séries por dia dariam vinte
linhas de atividade de trinta segundos cada, e qualquer exclusão de série
deixaria atividade órfã contando caloria de um esforço que não houve. A conta é
feita na leitura, por uma função pura, e entra no balanço como um segundo mapa
de kcal-por-dia.

### D6 · Meta diária opcional por exercício

"Sem método" é como o esforço acontece, não como ele é avaliado. Uma meta
diária opcional — 100 flexões/dia — é o que transforma um número solto em
progresso legível, sem impor série, descanso ou prescrição. Sem meta, o card
mostra o total do dia e a média; com meta, mostra o anel.

### D7 · Card de registro no Dashboard e página própria, sem 5ª aba

O registro tem que estar onde o polegar já está: um **card no Dashboard** (e o
mesmo card na aba "Hoje" do treino) com os exercícios que você usa como chips.
Um toque abre a folha já preenchida com a sua última quantidade; o segundo
grava.

A leitura profunda — histórico do dia com hora, semana, gráfico, recordes,
metas — mora em **`/treino/calistenia`**, alcançada pelo "Ver tudo" dos cards.
Rota dentro do `TreinoLayout`, acendendo a aba "Hoje" por `alias`.

Uma quinta aba foi descartada: em 390px as quatro atuais já ocupam a largura
inteira, e a barra passaria a rolar — escondendo justamente a aba nova.

---

## Modelo de dados

```sql
-- Uma série feita solta no dia. `created_at` é a HORA, e é dado: é ela que
-- responde "quando eu faço isso?" e desenha o dia.
CREATE TABLE IF NOT EXISTS calistenia_sets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  data           TEXT NOT NULL,              -- 'YYYY-MM-DD'
  exercise_id    INTEGER NOT NULL,
  reps           INTEGER CHECK (reps IS NULL OR reps > 0),
  segundos       INTEGER CHECK (segundos IS NULL OR segundos > 0),
  peso_extra_kg  REAL,                       -- colete, anilha; NULL = só o corpo
  created_at     TEXT NOT NULL,
  -- Uma medida por série, e exatamente uma: ver D3.
  CHECK ((reps IS NULL) <> (segundos IS NULL)),
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
CREATE INDEX IF NOT EXISTS idx_calistenia_user_data ON calistenia_sets (user_id, data);

-- Meta diária, opcional, um exercício por linha. Ausência = sem meta.
CREATE TABLE IF NOT EXISTS calistenia_metas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  exercise_id  INTEGER NOT NULL,
  alvo_dia     INTEGER NOT NULL CHECK (alvo_dia > 0),  -- reps ou segundos, conforme o exercício
  UNIQUE (user_id, exercise_id),
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
```

**Coluna aditiva** (em `ADDITIVE_COLUMNS` de `scripts/lib/apply-schema.ts`,
não em `schema.sql` — a tabela `exercises` já existe em banco em uso):

```
{ table: "exercises", column: "fracao_corporal",
  ddl: "ALTER TABLE exercises ADD COLUMN fracao_corporal REAL" }
```

**Limpeza:** as duas tabelas entram em `scripts/lib/limpar-dados.ts` como dado
de uso (`user_id IN (U)`), com o teste correspondente. `calistenia_metas` é
configuração do usuário, não catálogo — vai junto.

---

## Domínio — `src/domain/calistenia.ts`

Puro, sem banco e sem React. Recebe as séries e o peso corporal, devolve
números.

```ts
/** Quanto tempo uma repetição leva. Estimativa, e é assim que a tela a rotula. */
export const SEGUNDOS_POR_REP = 3;
/** "Calisthenics, vigorous effort" do Compendium of Physical Activities. */
export const MET_PADRAO = 8;
/** Exercício sem fração medida: metade do corpo. Conservador de propósito. */
export const FRACAO_PADRAO = 0.5;

export interface SerieAvulsa {
  id: number;
  data: string;
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

/** Carga levantada: fração do corpo + o que estiver pendurado nele. */
export function volumeEquivalente(s: SerieAvulsa, pesoCorporalKg: number): number;

/** Segundos de esforço: os próprios, ou reps × SEGUNDOS_POR_REP. */
export function segundosDeEsforco(s: SerieAvulsa): number;

/** kcal = MET × peso × horas. Mesma conta que o cardio da sessão faz. */
export function kcalDaSerie(s: SerieAvulsa, pesoCorporalKg: number): number;

export function totaisPorDia(series: SerieAvulsa[], pesoKg: number): Map<string, TotaisDoDia>;
export function totaisPorExercicio(series: SerieAvulsa[], pesoKg: number): TotalPorExercicio[];

/** Só a kcal, por dia — é o que a `/analise` soma ao gasto do cardio. */
export function kcalPorDia(series: SerieAvulsa[], pesoKg: number): Map<string, number>;

/** A maior série única de um exercício. É o "1RM" da calistenia. */
export function recordeDeSerie(series: SerieAvulsa[], exerciseId: number): number | null;

/** Dias consecutivos com registro, terminando em `hoje`. Zero se hoje não tem. */
export function sequenciaDeDias(datas: string[], hoje: string): number;

/** Variação percentual entre dois períodos. `null` quando a base é zero —
 *  "+∞%" não é uma tendência, é uma divisão por zero na tela. */
export function tendencia(atual: number, base: number): number | null;
```

O peso corporal vem de `profile.peso_kg`. Sem perfil, volume e kcal não são
calculados e a tela mostra reps — e convida a definir o peso, como o cardio da
sessão já faz.

---

## Repositório — `src/repositories/calistenia.ts`

```ts
registrarSerie(db, userId, { data, exercise_id, reps, segundos, peso_extra_kg })
apagarSerie(db, userId, id)
seriesDoDia(db, userId, data): SerieAvulsa[]
seriesPorRange(db, userId, inicio, fim): SerieAvulsa[]
/** Catálogo de peso corporal + os exercícios próprios do usuário. */
exerciciosDeCalistenia(db, userId): Exercise[]
/** Os chips do card: mais usados nos últimos 30 dias, mais os com meta. */
usadosRecentemente(db, userId, limite): { exercise_id, nome, ultima_qtd }[]
listarMetas(db, userId) / salvarMeta(db, userId, exerciseId, alvoDia) / apagarMeta(db, userId, exerciseId)
```

Todo SELECT junta `exercises` para trazer `nome`, `grupo`, `fracao_corporal` e
`met` — o domínio recebe a série pronta e não faz segunda consulta.

Hooks correspondentes em `src/hooks/use-calistenia.ts`, invalidando
`["calistenia", data]` e `["calistenia-metas"]`.

---

## Telas

### `components/calistenia/card-hoje.tsx`

Usado no Dashboard e na aba "Hoje" do treino — o mesmo componente, para as duas
telas não contarem histórias diferentes (o erro que o B9 registrou no treino).

```
┌──────────────────────────────┐
│ Calistenia hoje              │
│ ● Flexão de braço  40 / 100  │  ← anel só quando há meta
│ ● Agachamento livre      30  │
│ ● Prancha              2:00  │  ← isometria em mm:ss
│ [+ Flexão] [+ Abdominal] [+] │  ← chips = registro em 2 toques
│                    Ver tudo →│
└──────────────────────────────┘
```

Sem nada registrado hoje e sem histórico, o card vira `EmptyState` explicando o
que ele é. Com histórico e nada hoje, mostra os chips e o total de ontem.

### `components/calistenia/sheet-registrar.tsx`

Folha com o exercício no topo (trocável pelo `ExercicioAutocomplete` que já
existe, filtrado a peso corporal), stepper grande pré-preenchido com a **última
quantidade daquele exercício**, e um campo opcional de peso extra. Isometria
troca o stepper por incrementos de 5 s e rótulo `mm:ss`.

O botão grava e fecha. Um toque a mais, um registro a mais — é o gesto que o
uso real pede.

### `pages/treino-calistenia.tsx` — rota `/treino/calistenia`

Um `Segmented` com três visões, seguindo o padrão de `/treino/progresso`:

- **Hoje** — as séries do dia com a hora de cada uma (`14:32 · 20 flexões`),
  cada uma removível. É o registro cru, e é o que dá confiança no total.
- **Semana** — total por exercício, gráfico de reps/dia (`LineChart`, que já
  existe), sequência de dias e a tendência contra as 4 semanas anteriores.
- **Metas** — a meta diária de cada exercício, criável e removível.

Recorde de série por exercício aparece na visão Semana, ao lado do total.

### `/analise` — aba Atividade

`resumoAtividade` continua puro sobre `ActivitySession` — a calistenia entra
como segunda fonte, não como argumento a mais dele. A página soma
`kcalPorDia(series)` ao mapa de `kcalGastaPorDia(cardio)` antes de chamar
`balancoEnergetico`, e mostra um `Stat` próprio de reps e kcal da calistenia ao
lado do de cardio. É o ponto onde o módulo responde à pergunta que o motivou.

---

## Catálogo — o que falta

Dos 32 exercícios de peso corporal já catalogados, faltam movimentos que o
pedido cita nominalmente. Entram em `src/db/catalogo-exercicios.ts` com ficha
completa (o teste do catálogo exige `instrucoes` em toda entrada):

- **Agachamento livre sem peso** — hoje o único agachamento de peso corporal é
  o sissy, que não é o que ninguém faz solto na sala.
- **Afundo sem peso**
- **Burpee**
- **Polichinelo**
- **Agachamento com salto**

E `fracao_corporal` + `met` são preenchidas para os 37 exercícios de peso
corporal. `seedExercicios` já reescreve a ficha do catálogo a cada seed, então
as duas colunas entram no `INSERT` e no `UPDATE` existentes e chegam a quem já
tem banco.

---

## Testes

- **Domínio:** volume equivalente com e sem peso extra, kcal contra a mesma
  conta do cardio, totais por dia/exercício, recorde, sequência de dias
  (incluindo a quebra por dia vazio), tendência com base zero.
- **Repositório:** gravação e leitura das duas medidas, o `CHECK` de medida
  única, isolamento por usuário em toda função, chips por frequência, metas.
- **Catálogo:** invariante nova — todo exercício `peso_corporal` tem
  `fracao_corporal` e `met`.
- **Limpeza:** `limpar-dados` apaga as duas tabelas novas (o teste existente já
  povoa todas as tabelas que a limpeza toca).
- **Componentes:** o card em ambos os hospedeiros, a folha de registro, as três
  visões da página.
- **Integração:** uma série de calistenia registrada aparece na kcal gasta da
  `/analise` e no balanço — as duas pontas, como o teste de cardio faz.

---

## Fora de escopo

- **Prescrição e progressão de calistenia** (progressões para pistol squat,
  muscle-up). O pedido é explícito: "sem método". Prescrever seria devolver
  método a quem disse não querer um.
- **Cronômetro de isometria.** A prancha entra por stepper de 5 s. Um cronômetro
  de contagem crescente é componente novo e pode vir depois, medido pelo uso.
- **Lembrete / notificação** ("faz 4 horas que você não faz nada"). Depende de
  push notification, que o app não tem.
- **Calistenia dentro da sessão de treino.** Quem quer flexão no treino já pode
  adicioná-la como exercício avulso da sessão. Este módulo é para o que
  acontece FORA dela.

---

## Critérios de aceite

1. Registrar 20 flexões a partir do Dashboard custa dois toques, e o card mostra
   o total do dia imediatamente.
2. Prancha é registrada em segundos e exibida como `mm:ss` em toda tela.
3. Um dia só de calistenia **não** aparece em "treinos por semana" da
   consistência da rotina.
4. A kcal estimada da calistenia aparece no gasto e no balanço energético da
   `/analise`, no mesmo período.
5. Uma meta diária de 100 flexões mostra progresso no card e some do card
   quando removida.
6. Excluir uma série corrige todos os números do dia, sem deixar caloria órfã.
7. `npm test` passa inteiro; `npm run build` compila sem erro de tipo.
