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
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  source      TEXT NOT NULL,
  marca       TEXT,
  base_qty_g  REAL NOT NULL DEFAULT 100,
  kcal        REAL NOT NULL,
  prot_g      REAL NOT NULL,
  carb_g      REAL NOT NULL,
  gord_g      REAL NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_foods_nome ON foods (nome);

CREATE TABLE IF NOT EXISTS meals (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL,
  nome     TEXT NOT NULL,
  horario  TEXT,
  ordem    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meals_user ON meals (user_id, ordem);

CREATE TABLE IF NOT EXISTS food_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  data        TEXT NOT NULL,
  meal_id     INTEGER,
  food_id     INTEGER NOT NULL,
  qty_g       REAL NOT NULL CHECK (qty_g > 0),
  label       TEXT,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (meal_id) REFERENCES meals (id) ON DELETE SET NULL,
  FOREIGN KEY (food_id) REFERENCES foods (id)
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

CREATE TABLE IF NOT EXISTS exercises (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT NOT NULL,
  grupo_muscular  TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exercises_nome ON exercises (nome);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  data        TEXT NOT NULL,
  nome        TEXT,
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
