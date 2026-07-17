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
