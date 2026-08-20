# Treino guiado por 5/3/1

**Data:** 2026-08-14
**Status:** aprovado

## Problema

O módulo de treino é um caderno em branco. Você abre, digita o nome do
exercício, digita as reps, digita a carga. Toda sessão, do zero.

Para quem segue 5/3/1, isso é o pior arranjo possível: o método define a carga
de hoje por uma conta — percentual sobre o Training Max, que muda a cada semana
do ciclo — e o app faz o usuário resolver essa conta de cabeça, na academia,
para depois digitar o resultado. A parte que a máquina deveria fazer é
justamente a que sobra para a pessoa.

Some-se a isso que `/treino` é **uma tela fazendo cinco trabalhos**: sessão do
dia, cardio, biblioteca de exercícios, progressão e histórico, todos empilhados.
O que se usa de pé na academia, com uma mão, é o que menos espaço tem.

## Objetivo

1. O app sabe qual é o treino de hoje e com quanto peso, sem perguntar.
2. Registrar uma série é confirmar, não preencher.
3. Cada trabalho ganha a sua tela; a da academia é desenhada para a academia.

## Não-objetivos

- Outros métodos além do 5/3/1 nesta rodada (o import de planilha de programa
  vem depois, reaproveitando a tela de sessão).
- Variações de assistência do 5/3/1 (BBB, FSL, Joker sets). O usuário registra
  acessórios livremente, como hoje.
- Cronômetro rodando com o app fechado ou notificação de fim de descanso.

---

## Parte 1 — A matemática

Tudo em `src/domain/531.ts`, puro, sem React nem banco.

### Training Max

Todo percentual do método incide sobre o **Training Max**, não sobre o 1RM.
`TM = 90% do 1RM`, arredondado para o incremento de anilha. Confundir os dois
faz o usuário treinar ~11% mais pesado do que o método pede — é o erro clássico
de quem implementa 5/3/1, e a razão de o TM ser o valor guardado no banco.

### Ciclo de quatro semanas

| Semana | Séries de trabalho |
|---|---|
| 1 | 65%×5 · 75%×5 · **85%×5+** |
| 2 | 70%×3 · 80%×3 · **90%×3+** |
| 3 | 75%×5 · 85%×3 · **95%×1+** |
| 4 (deload) | 40%×5 · 50%×5 · 60%×5 |

O `+` é AMRAP: faça o máximo de repetições que conseguir. **A semana 4 não tem
AMRAP** — deload existe para recuperar, e transformá-lo em teste anula o
propósito.

Aquecimento, antes das séries de trabalho: 40%×5 · 50%×5 · 60%×3. Na semana de
deload o aquecimento é omitido: as próprias séries de trabalho já são 40/50/60%.

### Arredondamento

Barra e anilhas são discretas. `arredondarCarga(kg, incremento)` arredonda para
o múltiplo mais próximo do incremento configurado (padrão 2,5 kg). Empate
arredonda para baixo — em dúvida, a série mais leve é a que não custa a sessão.

### Progressão entre ciclos

Terminado o ciclo (as quatro semanas, todos os levantamentos), o TM sobe:
**+2,5 kg nos superiores** (supino, desenvolvimento) e **+5 kg nos inferiores**
(agachamento, terra). É por isso que cada levantamento guarda a que parte
pertence — o incremento não é o mesmo.

### 1RM estimado e recordes

Da série AMRAP sai o 1RM estimado por Epley: `peso × (1 + reps/30)`. A função
`e1RM` já existe em `domain/treino.ts` e é exatamente essa fórmula — é
reaproveitada, não reescrita.

Um **recorde** é ter feito mais repetições naquele peso do que em qualquer
sessão anterior do mesmo levantamento. É o que o método usa como motivação, e
por isso aparece na tela antes da série, não só depois.

### Qual é o treino de hoje

O estado do programa é **derivado**, não guardado: a partir das sessões já
concluídas, `proximaSessao` devolve ciclo, semana e levantamento da vez.
Levantamentos rodam na ordem configurada; completados os quatro, avança a
semana; completada a semana 4, avança o ciclo e os TMs sobem.

Derivar em vez de guardar evita o estado inconsistente clássico: apagar uma
sessão, ou registrar uma fora de ordem, corrige sozinho.

---

## Parte 2 — Modelo de dados

```sql
CREATE TABLE strength_programs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  nome          TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT '531',
  incremento_kg REAL NOT NULL DEFAULT 2.5,
  ativo         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE program_lifts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id  INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  tm_kg       REAL NOT NULL,
  parte       TEXT NOT NULL,   -- 'superior' | 'inferior' (define o incremento)
  ordem       INTEGER NOT NULL,
  FOREIGN KEY (program_id)  REFERENCES strength_programs (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);

-- Uma sessão concluída do programa. É daqui que o estado é derivado.
CREATE TABLE program_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  lift_id    INTEGER NOT NULL,
  ciclo      INTEGER NOT NULL,
  semana     INTEGER NOT NULL,
  tm_kg      REAL NOT NULL,   -- o TM VIGENTE naquele dia
  data       TEXT NOT NULL,
  session_id INTEGER,         -- workout_sessions, onde as séries ficam
  created_at TEXT NOT NULL,
  UNIQUE (user_id, program_id, lift_id, ciclo, semana)
);
```

`tm_kg` é copiado para `program_sessions` de propósito. O TM sobe a cada ciclo;
sem o valor da época, uma sessão de três meses atrás mostraria percentuais
calculados sobre o TM de hoje, e o histórico contaria uma mentira.

**Colunas aditivas** em `workout_sets`, via `ADDITIVE_COLUMNS`:
`prescribed_pct REAL` e `amrap INTEGER` — para o histórico saber qual série era
a AMRAP e sobre que percentual. O que já está registrado continua válido com
ambas nulas.

---

## Parte 3 — As telas

Uma tela por trabalho. `/treino` deixa de ser um depósito.

| Rota | Trabalho |
|---|---|
| `/treino` | Hub: o que é hoje, e o caminho para o resto |
| `/treino/sessao` | **A tela da academia** |
| `/treino/programa` | Configurar 5/3/1: levantamentos, TM, incremento |
| `/treino/progressao` | Gráficos e recordes por levantamento |
| `/treino/historico` | Sessões passadas |
| `/treino/exercicios` | Biblioteca de exercícios |
| `/treino/cardio` | Cardio |

### `/treino/sessao` — a única que importa de verdade

Usada de pé, com uma mão, entre séries.

- Um levantamento por vez; navegação por baixo entre os exercícios da sessão.
- Aquecimento recolhido por padrão: é ritual, não decisão.
- Séries de trabalho já vêm com carga e reps calculadas. Tocar registra.
- **Só a AMRAP tem contador de repetições**, porque é a única que varia. O
  recorde a bater aparece antes da série.
- Cronômetro de descanso começa sozinho ao registrar uma série.
- Alvos de toque grandes; nada de teclado no caminho comum.

### `/treino/programa` — o setup

Resolve o problema de onde vêm os números: o app pergunta. Escolhe os
levantamentos, informa 1RM **ou** TM (o app converte 90%), escolhe o incremento
de anilha. Depois, é onde o TM é revisto — inclusive quando o app sugere subir
com base num e1RM recorde.

### `/treino` — o hub

Card grande com a sessão de hoje (levantamento, ciclo, semana, e as cargas já
calculadas) e um botão para começar. Abaixo, as últimas sessões e os atalhos
para as outras telas. Sem programa configurado, o card vira o convite para
configurar.

---

## Parte 4 — Testes

| Camada | O que cobre |
|---|---|
| `domain/531` | Percentuais de cada semana, deload sem AMRAP, arredondamento (incluindo empate), TM a partir do 1RM, subida por parte do corpo, e1RM, recorde, derivação de ciclo/semana/levantamento |
| Repositories | libSQL em memória: gravar sessão, derivar próxima, TM histórico preservado, isolamento por usuário |
| Componentes | Registrar série, contador de AMRAP, recorde, aquecimento recolhido, navegação entre exercícios |
| Ao vivo | Playwright: setup do programa → sessão → registrar todas as séries → AMRAP com recorde → conferir avanço |

O critério de aceite da matemática é uma tabela de referência do próprio método:
TM 100 kg, incremento 2,5, as quatro semanas conferidas série a série.
