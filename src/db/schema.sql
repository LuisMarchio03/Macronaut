CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS profile (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL UNIQUE,
  sexo             TEXT NOT NULL,
  data_nascimento  TEXT NOT NULL,
  altura_cm        REAL NOT NULL,
  peso_kg          REAL NOT NULL,
  fator_atividade  REAL NOT NULL,
  objetivo         TEXT NOT NULL,
  meta_kcal        REAL NOT NULL,
  meta_prot_g      REAL NOT NULL,
  meta_carb_g      REAL NOT NULL,
  meta_gord_g      REAL NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS foods (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                TEXT NOT NULL,
  source              TEXT NOT NULL,
  marca               TEXT,
  base_qty_g          REAL NOT NULL DEFAULT 100,
  base_unit           TEXT NOT NULL DEFAULT 'g',
  default_measure_id  INTEGER,
  kcal                REAL NOT NULL,
  prot_g              REAL NOT NULL,
  carb_g              REAL NOT NULL,
  gord_g              REAL NOT NULL,
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_foods_nome ON foods (nome);

CREATE TABLE IF NOT EXISTS food_measures (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id   INTEGER NOT NULL,
  nome      TEXT NOT NULL,
  qty_base  REAL NOT NULL CHECK (qty_base > 0),
  ordem     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_food_measures_food ON food_measures (food_id, ordem);

CREATE TABLE IF NOT EXISTS meals (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL,
  nome     TEXT NOT NULL,
  horario  TEXT,
  ordem    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meals_user ON meals (user_id, ordem);

CREATE TABLE IF NOT EXISTS food_entries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  data           TEXT NOT NULL,
  meal_id        INTEGER,
  food_id        INTEGER NOT NULL,
  qty_g          REAL NOT NULL CHECK (qty_g > 0),
  measure_id     INTEGER,
  measure_count  REAL,
  label          TEXT,
  created_at     TEXT NOT NULL,
  FOREIGN KEY (meal_id) REFERENCES meals (id) ON DELETE SET NULL,
  FOREIGN KEY (food_id) REFERENCES foods (id),
  FOREIGN KEY (measure_id) REFERENCES food_measures (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_user_data ON food_entries (user_id, data);

CREATE TABLE IF NOT EXISTS water_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  data        TEXT NOT NULL,
  ml          REAL NOT NULL CHECK (ml > 0),
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_user_data ON water_log (user_id, data);

CREATE TABLE IF NOT EXISTS muscle_groups (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nome    TEXT NOT NULL UNIQUE,
  regiao  TEXT NOT NULL,   -- 'superior' | 'inferior' | 'core'
  cadeia  TEXT             -- 'push' | 'pull' | NULL (NULL nos inferiores, de propósito)
);

CREATE TABLE IF NOT EXISTS exercises (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER,                          -- NULL = catálogo global
  nome            TEXT NOT NULL,
  grupo_muscular  TEXT,                             -- LEGADO: não escrever, ver spec
  grupo_id        INTEGER REFERENCES muscle_groups (id),
  source          TEXT NOT NULL DEFAULT 'custom',   -- 'catalogo' | 'custom'
  tipo            TEXT,                             -- 'composto' | 'isolado'
  equipamento     TEXT,                             -- 'barra'|'halter'|'maquina'|'polia'|'peso_corporal'
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exercises_nome ON exercises (nome);
-- idx_exercises_user (user_id, nome) e idx_exercises_source_nome (source, nome)
-- NÃO ficam aqui: `user_id` e `source` são colunas aditivas (ver ADDITIVE_COLUMNS
-- em scripts/lib/apply-schema.ts). Num banco legado, `exercises` já existe na
-- forma antiga e este `CREATE TABLE IF NOT EXISTS` é no-op — um `CREATE INDEX`
-- aqui, antes do `ALTER TABLE ADD COLUMN`, faria `executeMultiple` explodir com
-- "no such column" e abortar o schema inteiro no meio. Esses dois índices são
-- criados por `applyAdditiveColumns` (ADDITIVE_INDEXES), depois das colunas.

CREATE TABLE IF NOT EXISTS workout_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  data        TEXT NOT NULL,
  nome        TEXT,
  nota        TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wsessions_user_data ON workout_sessions (user_id, data);

CREATE TABLE IF NOT EXISTS workout_sets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  session_id   INTEGER NOT NULL,
  exercise_id  INTEGER NOT NULL,
  ordem        INTEGER NOT NULL,
  reps         INTEGER NOT NULL CHECK (reps > 0),
  peso_kg      REAL NOT NULL CHECK (peso_kg >= 0),
  tipo         TEXT NOT NULL DEFAULT 'valida',  -- 'aquecimento'|'valida'|'drop'|'falha'
  rir          INTEGER CHECK (rir IS NULL OR (rir >= 0 AND rir <= 4)),
  nota         TEXT,
  created_at   TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES workout_sessions (id),
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
CREATE INDEX IF NOT EXISTS idx_wsets_user_session ON workout_sets (user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_wsets_user_exercise ON workout_sets (user_id, exercise_id);

CREATE TABLE IF NOT EXISTS activity_types (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL,
  met   REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  data         TEXT NOT NULL,
  tipo         TEXT NOT NULL,
  duracao_min  REAL NOT NULL CHECK (duracao_min > 0),
  kcal         REAL NOT NULL CHECK (kcal >= 0),
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_asessions_user_data ON activity_sessions (user_id, data);

CREATE TABLE IF NOT EXISTS weigh_ins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  data        TEXT NOT NULL,
  peso_kg     REAL NOT NULL CHECK (peso_kg > 0),
  created_at  TEXT NOT NULL,
  UNIQUE (user_id, data)
);
CREATE INDEX IF NOT EXISTS idx_weighins_user_data ON weigh_ins (user_id, data);

CREATE TABLE IF NOT EXISTS ai_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  provider    TEXT NOT NULL,          -- 'gemini' | 'aloy'
  session_id  TEXT NOT NULL,          -- gemini: uuid nosso; aloy: id devolvido pela ALOY
  role        TEXT NOT NULL,          -- 'user' | 'assistant'
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages (user_id, provider, session_id, id);

-- Favoritas de refeição. É o mesmo conceito que o cadastro de dietas vai usar:
-- um conjunto nomeado de alimentos com suas medidas. Dietas referencia estas
-- tabelas em vez de criar as suas — ver spec 2026-07-17, decisão D4.
CREATE TABLE IF NOT EXISTS meal_templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  nome        TEXT NOT NULL,
  meal_id     INTEGER,   -- refeição de origem: só define ONDE a favorita é
                         -- sugerida no dashboard. NULL = qualquer refeição.
                         -- Não restringe: aplicar noutra refeição é permitido.
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meal_templates_user ON meal_templates (user_id, nome);

-- Snapshot: copia qty_g E measure_id/measure_count. A favorita guarda a
-- INTENÇÃO ("2 fatias"), não o número congelado — se a medida for corrigida
-- de 25g para 28g, a favorita passa a registrar 56g. Ponteiro para o
-- histórico não serviria: entries podem ser deletadas pelo usuário.
CREATE TABLE IF NOT EXISTS meal_template_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id    INTEGER NOT NULL,
  food_id        INTEGER NOT NULL,
  qty_g          REAL NOT NULL CHECK (qty_g > 0),
  measure_id     INTEGER,
  measure_count  REAL,
  ordem          INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (template_id) REFERENCES meal_templates (id) ON DELETE CASCADE,
  FOREIGN KEY (food_id)     REFERENCES foods (id),
  FOREIGN KEY (measure_id)  REFERENCES food_measures (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_mt_items_template ON meal_template_items (template_id, ordem);

-- ═══════════════════════════════════════════════════════════════════
-- PLANO ALIMENTAR
--
-- Um plano descreve o dia: o que comer, quando, quanta água em cada
-- período. Ele NÃO substitui `food_entries` — o diário continua sendo o
-- registro do que foi de fato comido. `plan_checks` liga os dois.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS diet_plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  nome          TEXT NOT NULL,
  origem        TEXT NOT NULL,          -- 'xlsx' | 'csv' | 'manual'
  kcal_min      REAL,                   -- "Meta Calórica Diária: 1700-2000"
  kcal_max      REAL,
  prot_alvo_g   REAL,
  agua_ml_alvo  REAL,
  -- Um plano ativo por usuário. Importar outro desativa o anterior em vez de
  -- apagá-lo: o histórico de plan_checks continua fazendo sentido.
  ativo         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diet_plans_user ON diet_plans (user_id, ativo);

-- Os três tipos de bloco moram na mesma tabela porque a tela precisa deles
-- como UMA linha do tempo ordenada. Em três tabelas, todo render teria que
-- mesclar e reordenar.
CREATE TABLE IF NOT EXISTS plan_blocks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id      INTEGER NOT NULL,
  tipo         TEXT NOT NULL,           -- 'refeicao' | 'agua' | 'suplemento'
  nome         TEXT NOT NULL,
  hora_inicio  TEXT,                    -- 'HH:MM'
  hora_fim     TEXT,
  ancora       TEXT,                    -- 'Após almoço', quando não há horário
  kcal_alvo    REAL,
  ml_alvo      REAL,
  observacao   TEXT,
  ordem        INTEGER NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES diet_plans (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_plan_blocks_plan ON plan_blocks (plan_id, ordem);

CREATE TABLE IF NOT EXISTS plan_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id   INTEGER NOT NULL,
  -- Sempre preenchido: é o que a tela mostra. food_id/qty_g são o
  -- enriquecimento que permite o botão "Comi" gravar entries reais; sem eles
  -- o bloco ainda marca como feito e credita kcal_alvo.
  texto      TEXT NOT NULL,
  categoria  TEXT,                      -- 'proteina'|'carboidrato'|'fruta'|'gordura'|'vegetal'
  food_id    INTEGER,
  qty_g      REAL,
  ordem      INTEGER NOT NULL,
  FOREIGN KEY (block_id) REFERENCES plan_blocks (id) ON DELETE CASCADE,
  FOREIGN KEY (food_id)  REFERENCES foods (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_items_block ON plan_items (block_id, ordem);

-- Referencia o bloco por NOME, não por id: nas abas Macros e Substituicoes a
-- chave que o usuário digita é o nome da refeição. Casar por nome mantém a
-- planilha como contrato e não exige que as três abas estejam na mesma ordem.
CREATE TABLE IF NOT EXISTS plan_macros (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL,
  block_nome TEXT NOT NULL,
  prot_g     REAL NOT NULL,
  carb_g     REAL NOT NULL,
  gord_g     REAL NOT NULL,
  kcal       REAL NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES diet_plans (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_plan_macros_plan ON plan_macros (plan_id);

CREATE TABLE IF NOT EXISTS plan_swaps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL,
  block_nome TEXT NOT NULL,
  categoria  TEXT NOT NULL,
  alimento   TEXT NOT NULL,
  porcao     TEXT NOT NULL,             -- '3 unidades (150g)'
  qty_g      REAL,                      -- extraído de porcao quando dá
  kcal       REAL NOT NULL,
  food_id    INTEGER,
  FOREIGN KEY (plan_id) REFERENCES diet_plans (id) ON DELETE CASCADE,
  FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_swaps_plan ON plan_swaps (plan_id, block_nome, categoria);

CREATE TABLE IF NOT EXISTS plan_checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  plan_id    INTEGER NOT NULL,
  data       TEXT NOT NULL,             -- 'YYYY-MM-DD'
  block_id   INTEGER NOT NULL,
  feito      INTEGER NOT NULL DEFAULT 1,
  swap_id    INTEGER,
  created_at TEXT NOT NULL,
  -- Um bloco só pode ser marcado uma vez por dia; marcar de novo é atualizar.
  UNIQUE (user_id, data, block_id),
  FOREIGN KEY (block_id) REFERENCES plan_blocks (id) ON DELETE CASCADE,
  FOREIGN KEY (swap_id)  REFERENCES plan_swaps (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_checks_dia ON plan_checks (user_id, data);

-- ═══════════════════════════════════════════════════════════════════
-- ROTINA DE TREINO
--
-- A espinha do módulo. Sete dias da semana; dia sem entrada é
-- descanso — a ausência é o dado, e não um registro de "descanso" que
-- precisaria ser criado e mantido em sincronia.
--
-- As tabelas do programa 5/3/1 (strength_programs, program_lifts,
-- program_sessions) saíram daqui: o Training Max virou coluna de
-- routine_exercises, e a posição no ciclo passou a ser derivada das
-- sessões do próprio exercício. Num banco que já existe elas continuam
-- lá com os dados — remover do schema não emite DROP, de propósito.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS routines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  nome       TEXT NOT NULL,
  ativa      INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_routines_user ON routines (user_id, ativa);

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
  -- 'fixa': a carga. 'dupla': o ponto de partida, até haver histórico.
  peso_kg       REAL,
  incremento_kg REAL NOT NULL DEFAULT 2.5,
  tm_kg         REAL,       -- só '531'
  parte         TEXT,       -- só '531': 'superior' | 'inferior'
  descanso_s    INTEGER,
  FOREIGN KEY (day_id)      REFERENCES routine_days (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
CREATE INDEX IF NOT EXISTS idx_routine_ex_day ON routine_exercises (day_id, ordem);

-- O plano congelado de uma sessão.
--
-- Tabela separada de workout_sets de propósito: meia dúzia de consultas já
-- lê workout_sets como "o que foi feito" (setsForAnalise, setsForExercise,
-- ultimaVezExercicio, o histórico, a progressão, o balanço energético). Uma
-- coluna `feito` ali obrigaria todas a filtrar, e a que ficasse de fora
-- contaria série planejada como treino realizado — num número que ninguém
-- confere.
--
-- `ordem` é a posição na sessão inteira (é ela que desenha a tela);
-- `serie_ordem` é a posição dentro do exercício e é o que vai para
-- workout_sets.ordem, que `ultimaVezExercicio` já assume no seu ORDER BY.
CREATE TABLE IF NOT EXISTS session_plan_sets (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL,
  session_id          INTEGER NOT NULL,
  routine_exercise_id INTEGER,          -- NULL quando o exercício foi avulso
  exercise_id         INTEGER NOT NULL,
  ordem               INTEGER NOT NULL,
  serie_ordem         INTEGER NOT NULL,
  peso_kg             REAL NOT NULL,
  reps_alvo           INTEGER NOT NULL,
  reps_min            INTEGER,
  tipo                TEXT NOT NULL DEFAULT 'valida',
  amrap               INTEGER NOT NULL DEFAULT 0,
  pct                 REAL,
  descanso_s          INTEGER,
  set_id              INTEGER,          -- workout_sets; NULL = ainda não feita
  FOREIGN KEY (session_id)  REFERENCES workout_sessions (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
CREATE INDEX IF NOT EXISTS idx_plan_sets_session ON session_plan_sets (user_id, session_id, ordem);
