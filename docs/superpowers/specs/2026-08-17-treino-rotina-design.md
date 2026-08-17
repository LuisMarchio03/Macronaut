# Treino: rotina semanal, sessão materializada e dupla progressão

**Data:** 2026-08-17
**Status:** aprovado
**Substitui:** `2026-08-14-treino-531-design.md` (o 5/3/1 deixa de ser a espinha
e passa a ser um tipo de prescrição)

## Problema

O redesenho anterior construiu o módulo de treino inteiro em torno do 5/3/1 —
e o usuário não treina 5/3/1. O app sabe calcular com precisão um treino que
ninguém faz, e não sabe registrar o treino que é feito de verdade.

O sintoma mais grave é funcional, não estético: ao promover o 5/3/1 a espinha,
a tela de registro livre (`TreinoTab`) ficou **órfã** — o componente existe,
tem teste, e não está montado em rota nenhuma. Hoje o app não consegue
registrar nada que não seja o levantamento principal de um programa 5/3/1. Nem
acessório, nem treino de braço, nem um dia improvisado.

O segundo problema é de arquitetura de dados: a sessão só existe em `useState`
até o "Finalizar". Fechou o app no meio do treino, perdeu a sessão inteira.

O terceiro é que a rotina real do usuário — que existe, na cabeça e no papel —
não tem onde morar. Não há como dizer ao app "segunda é peito".

## Objetivo

1. A rotina de treino existe dentro do app, organizada por **dia da semana**.
2. O app abre no dia certo já sabendo os exercícios, as séries e **a carga**.
3. A carga sobe sozinha por **dupla progressão**, com base no desempenho.
4. Uma sessão em andamento sobrevive a fechar o app.
5. Treinar fora da rotina volta a ser possível — e não como tela separada.
6. O 5/3/1 vira uma opção de prescrição por exercício, não o dono do módulo.

## Não-objetivos

Ficam para uma segunda rodada, intocados: `/treino/cardio`,
`/treino/exercicios`, `/treino/historico` e `/treino/progressao`. Esta rodada
é rotina, sessão e progressão de carga.

Também não entram: rotinas com ciclo diferente de uma semana, importação de
planilha de treino, mais de uma rotina ativa ao mesmo tempo, e notificação de
fim de descanso com o app fechado.

---

## Parte 1 — Os conceitos

Três coisas, e a distinção entre as duas últimas é o coração do desenho.

**Rotina** — o que você *pretende* treinar. Sete dias da semana; cada um tem um
treino ou é descanso. Muda raramente.

**Plano da sessão** — o que o app *prescreveu* para hoje, congelado no momento
em que você tocou "Começar treino". É derivado da rotina mais o seu histórico,
mas depois de criado é dado: mexer na rotina no meio da semana não reescreve o
treino de terça.

**Registro** — o que você *fez*. É o que já vive em `workout_sessions` e
`workout_sets` e alimenta histórico, progressão, análise e balanço energético.

### Por que plano e registro são tabelas separadas

A alternativa óbvia era guardar as séries planejadas no próprio `workout_sets`
com uma coluna `feito`. Foi descartada: **seis consultas e cinco funções de
domínio já leem `workout_sets` sem saber que essa coluna existiria**
(`setsForAnalise`, `setsForExercise`, `ultimaVezExercicio`, `serieDeProgressao`,
`seriesEfetivas`, o histórico, o balanço energético). Cada uma passaria a
precisar de um filtro, e a que ficasse de fora contaria série planejada e não
feita como treino realizado — silenciosamente, num número que ninguém confere.

Uma tabela separada mantém o registro com o significado que ele sempre teve:
`workout_sets` é o que aconteceu. Uma linha de plano que nunca virou série é,
com precisão, o que ela é — algo que você não fez.

---

## Parte 2 — A matemática

Tudo em `src/domain/prescricao.ts`, puro, sem React nem banco.

### O contrato

```ts
export type Prescricao =
  | { tipo: "dupla"; series: number; reps_min: number; reps_max: number;
      peso_inicial_kg: number; incremento_kg: number }
  | { tipo: "fixa";  series: number; reps: number; peso_kg: number }
  | { tipo: "531";   tm_kg: number; parte: Parte; incremento_kg: number };

export interface SessaoAnterior {
  data: string;
  sets: { reps: number; peso_kg: number }[];   // só séries efetivas
}

export interface SeriePlanejada {
  ordem: number;          // posição da série dentro do exercício, 1..n
  peso_kg: number;
  reps_alvo: number;      // o número a bater
  reps_min: number | null;// a faixa, quando há faixa
  tipo: TipoSerie;        // 'aquecimento' | 'valida'
  amrap: boolean;
  pct: number | null;     // só 5/3/1
}

/** `anteriores` vem da mais recente para a mais antiga. */
export function planejar(p: Prescricao, anteriores: SessaoAnterior[]): SeriePlanejada[]
```

Uma função, três estratégias, despacho por `tipo`. Quem chama não sabe qual é.

### Dupla progressão

A regra, dado o peso `P` e as repetições `[r1..rn]` da sessão anterior:

| Situação | Próxima sessão |
|---|---|
| Sem histórico | `peso_inicial_kg`, alvo `reps_max` |
| Todas as séries ≥ `reps_max` | `P + incremento_kg`, alvo `reps_max` |
| Todas ≥ `reps_min`, alguma < `reps_max` | `P` mantido, alvo `reps_max` |
| Alguma série < `reps_min` | `P` mantido, alvo `reps_max` |
| Alguma < `reps_min` **duas sessões seguidas no mesmo peso** | `P × 0,9` arredondado, alvo `reps_max` |

O alvo mostrado é sempre `reps_max` — é o número que faz a carga subir, e é
por isso que ele é o que aparece na tela. A faixa (`reps_min`) aparece ao lado,
porque terminar dentro dela não é falhar.

Duas observações que a tabela esconde:

- **A carga só sobe com a série mais fraca.** Bastam 11 repetições numa série
  de 12 para a carga ficar. Isso é a dupla progressão sendo dupla — se a
  décima segunda repetição da última série ainda não sai, o peso não é seu.
- **Descer exige reincidência.** Um dia ruim não derruba a carga; dois dias
  ruins **no mesmo peso**, sim. Um único mau dia derrubando o peso faria a
  progressão oscilar em torno de um número em vez de subir.

O arredondamento reaproveita `arredondarCarga` de `domain/531.ts` — a mesma
conta, o mesmo empate-desce, uma implementação só.

### 5/3/1 como prescrição

Sobrevive inteiro em `domain/531.ts`. O que muda é de onde vem a posição no
ciclo: em vez das tabelas `program_sessions`, ela é derivada de **quantas
sessões daquele exercício já foram feitas**:

```
n = anteriores.length
semana = (n % 4) + 1
ciclo  = ⌊n / 4⌋ + 1
tm     = tmVigente(tm_kg, parte, ciclo - 1, incremento_kg)
```

Isso é mais correto para uma rotina semanal do que a regra antiga, que só
avançava a semana quando os quatro levantamentos tivessem sido feitos. Numa
rotina, cada exercício anda no seu próprio passo — e agora anda.

### Qual é o treino de hoje

```ts
export function treinoDoDia<T extends { dia_semana: number }>(dias: T[], diaSemana: number): T | null
export function proximoTreino<T extends { dia_semana: number }>(dias: T[], diaSemana: number): T | null
```

Puras, sobre o número do dia (0 = domingo). `proximoTreino` dá a volta na
semana e devolve `null` se a rotina não tem dia nenhum. `date.ts` ganha
`diaSemana(data: string): number`, que reaproveita o construtor `local` já
existente — `new Date("2026-08-17").getDay()` interpreta a string como UTC e, a
oeste de Greenwich, responde o dia anterior.

---

## Parte 3 — Modelo de dados

```sql
CREATE TABLE IF NOT EXISTS routines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  nome       TEXT NOT NULL,
  ativa      INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

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

-- O plano congelado de uma sessão. Existe enquanto a sessão existir.
CREATE TABLE IF NOT EXISTS session_plan_sets (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL,
  session_id          INTEGER NOT NULL,
  routine_exercise_id INTEGER,          -- NULL quando o exercício foi avulso
  exercise_id         INTEGER NOT NULL,
  ordem               INTEGER NOT NULL, -- posição na sessão inteira
  serie_ordem         INTEGER NOT NULL, -- posição dentro do exercício
  peso_kg             REAL NOT NULL,
  reps_alvo           INTEGER NOT NULL,
  reps_min            INTEGER,
  tipo                TEXT NOT NULL DEFAULT 'valida',
  amrap               INTEGER NOT NULL DEFAULT 0,
  pct                 REAL,
  descanso_s          INTEGER,
  set_id              INTEGER,          -- workout_sets; NULL = ainda não feita
  FOREIGN KEY (session_id) REFERENCES workout_sessions (id) ON DELETE CASCADE
);
```

Índices: `routines (user_id, ativa)`, `routine_days (routine_id, dia_semana)`,
`routine_exercises (day_id, ordem)`, `session_plan_sets (user_id, session_id, ordem)`.

`session_plan_sets.set_id` é o elo entre prescrito e realizado. Registrar uma
série é inserir em `workout_sets` e gravar o id de volta; desfazer é apagar a
série e zerar o elo. Com isso, "3×10 a 40 kg, você fez 10/10/8" é uma consulta,
não uma reconstrução.

São **duas** colunas de ordem porque são duas perguntas diferentes, e uma
coluna só respondendo as duas seria a origem de um bug silencioso.
`session_plan_sets.ordem` é a posição na sessão inteira (1..N, exercícios em
blocos contíguos) e é ela que desenha a tela. `serie_ordem` é a posição da
série **dentro do exercício** (1..n) e é o valor copiado para
`workout_sets.ordem` no momento do registro — porque é isso que
`ultimaVezExercicio` já assume no seu `ORDER BY ordem`, e mudar esse
significado corromperia a leitura do histórico que já está gravado.

`domain/prescricao.ts` só conhece a segunda: `planejar` devolve as séries de
**um** exercício, numeradas de 1 a n. A ordem global é atribuída pelo
repository ao materializar, que é quem sabe o que mais tem na sessão.

**Sobre as tabelas do 5/3/1.** `strength_programs`, `program_lifts` e
`program_sessions` saem de `schema.sql` junto com `repositories/programa.ts` e
`hooks/use-programa.ts` — o TM e a parte do corpo passam a morar em
`routine_exercises`. Nenhum `DROP TABLE` é emitido: num banco existente as
tabelas continuam lá, inertes, com os dados intactos. Apagar dado de usuário
para limpar um esquema não é troca que valha a pena, e um banco novo
simplesmente não as cria.

---

## Parte 4 — As telas

### `/treino` — o hub

O card grande deixa de ser "a sessão do 5/3/1" e passa a ser **hoje**:

- **Dia de treino:** nome do dia ("Peito e tríceps"), os exercícios com séries,
  faixa de reps e a carga já calculada, e um botão "Começar treino".
- **Sessão já iniciada hoje:** o mesmo card vira "Retomar treino", com quantas
  séries de quantas já foram.
- **Dia de descanso:** um card menor — "Descanso. Próximo: quarta · Costas e
  bíceps" — e, discreto, "Treinar mesmo assim", que abre uma sessão vazia.
- **Sem rotina:** o convite para montar a rotina.

Abaixo, as últimas sessões e os atalhos. O atalho "Programa" vira "Rotina".

### `/treino/rotina` — montar a rotina

Os sete dias listados, de domingo a sábado, cada um mostrando o nome do treino
e quantos exercícios tem, ou "Descanso". Tocar num dia abre o editor daquele
dia: nome do treino, lista ordenável de exercícios, e "Adicionar exercício"
pelo `ExercicioAutocomplete` que já existe.

Tocar num exercício abre um `Sheet` com a prescrição: o tipo (dupla / fixa /
5/3/1), número de séries, faixa de repetições, peso de partida, incremento e
descanso. Os campos mostrados seguem o tipo — pedir Training Max a quem
escolheu dupla progressão seria pedir um número que não vai ser usado.

Os padrões importam mais do que a tela: **3 séries, 8 a 12 repetições,
incremento 2,5 kg**. Quem só quiser adicionar um exercício e sair não precisa
tocar em nada.

### `/treino/sessao` — a tela da academia

Continua fora do layout com barra de navegação: na academia a tela é inteira.

- **Um exercício por vez**, com navegação entre eles no rodapé e o progresso da
  sessão no topo (séries feitas / total).
- Sob o nome do exercício, **"Última vez: 3×10 @ 40 kg"** — o contexto que
  justifica a carga de hoje.
- As séries planejadas são linhas grandes com `alvo × peso`. **Tocar registra**
  a série exatamente como planejada. É o caminho comum e não abre teclado.
- Se hoje foi diferente, o botão "Ajustar" na linha abre um `Sheet` com reps,
  peso, tipo (válida / aquecimento / drop / falha), RIR e nota — tudo o que o
  antigo `NovaSerieForm` oferecia, agora onde faz falta.
- A série AMRAP do 5/3/1 mantém o contador de repetições e o recorde a bater,
  como já era.
- O cronômetro de descanso arranca ao registrar, com o `descanso_s` do
  exercício. O componente `CronometroDescanso` já existe e é reaproveitado.
- Registrada a última série de um exercício, a tela avança sozinha para o
  próximo — o gesto que você faria de qualquer jeito.
- **"Adicionar exercício"** no fim da lista: escolhe no autocomplete e o app
  planeja na hora por dupla progressão, a partir do histórico daquele
  exercício. É assim que o treino fora da rotina volta — não como uma segunda
  tela com outra gramática, mas como o mesmo fluxo.
- Rodapé: "Finalizar treino".

Sair da tela não desfaz nada: o plano e as séries registradas estão no banco. É
o mesmo botão "Retomar" no hub que traz de volta.

### O que é apagado

`TreinoTab`, `NovaSerieForm` e `ListaSeriesExercicio` (com seus testes) saem: a
sessão nova faz o que eles faziam, no lugar certo. `ExercicioAutocomplete` e
`CronometroDescanso` ficam, reaproveitados. A rota `/treino/programa` e a tela
`TreinoPrograma` dão lugar a `/treino/rotina`.

---

## Parte 5 — Camadas

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/prescricao.ts` | `planejar`, dupla progressão, `treinoDoDia`, `proximoTreino`. Puro. |
| `src/domain/531.ts` | Intocado, salvo por passar a ser chamado por `prescricao.ts`. |
| `src/repositories/rotina.ts` | CRUD de rotina, dias e exercícios. |
| `src/repositories/sessao.ts` | Criar sessão a partir do plano, registrar/desfazer série, adicionar exercício avulso, ler o plano. |
| `src/repositories/workouts.ts` | Ganha `historicoExercicio(db, userId, exerciseId, antesDe, limite)` — as N sessões efetivas anteriores, que é o insumo de `planejar`. |
| `src/hooks/use-rotina.ts`, `src/hooks/use-sessao.ts` | Wrappers do TanStack Query. |
| `src/pages/treino.tsx`, `treino-rotina.tsx`, `treino-sessao.tsx` | As três telas. |

A regra que já vale no projeto continua valendo: todo SQL nos repositories,
nenhuma conta na tela.

---

## Parte 6 — Testes

| Camada | O que cobre |
|---|---|
| `domain/prescricao` | Cada linha da tabela da dupla progressão, incluindo o deload só na reincidência e no mesmo peso; sem histórico; despacho para 5/3/1 com semana/ciclo derivados de `n`; `treinoDoDia` e `proximoTreino` com a volta na semana e rotina vazia |
| `lib/date` | `diaSemana` a oeste de Greenwich — a data que viraria o dia anterior em UTC |
| `repositories/rotina` | libSQL em memória: criar/editar/apagar, cascata de dia para exercícios, `UNIQUE` do dia da semana, isolamento por usuário |
| `repositories/sessao` | Materializar o plano; registrar liga `set_id`; desfazer apaga a série e zera o elo; exercício avulso entra com `routine_exercise_id` nulo; **`workout_sets` não recebe nada de série não registrada** |
| Componentes | Hub nos quatro estados (treino, retomar, descanso, sem rotina); sessão: registrar por toque, ajustar pelo sheet, avanço automático, adicionar exercício avulso |

O critério de aceite da dupla progressão é uma tabela de referência com um
exercício ao longo de seis sessões: sobe, mantém, mantém, falha, falha, desce —
conferida série a série.
