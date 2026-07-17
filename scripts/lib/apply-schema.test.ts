import { it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyAdditiveColumns } from "./apply-schema";
import { createTestDb } from "../../test/helpers/test-db";

const here = fileURLToPath(import.meta.url);
const schemaPath = resolve(dirname(here), "../../src/db/schema.sql");

async function colunas(db: ReturnType<typeof createClient>, tabela: string): Promise<string[]> {
  const rs = await db.execute(`PRAGMA table_info(${tabela})`);
  return rs.rows.map((r) => r.name as string);
}

it("adiciona as colunas de IA em users e é idempotente", async () => {
  const db = createClient({ url: ":memory:" });
  await db.execute(
    "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, password_hash TEXT, created_at TEXT)",
  );
  await db.execute(
    "CREATE TABLE foods (id INTEGER PRIMARY KEY, nome TEXT, source TEXT, marca TEXT, base_qty_g REAL, kcal REAL, prot_g REAL, carb_g REAL, gord_g REAL, created_at TEXT)",
  );
  // `food_measures` já existe na via de migração real: `executeMultiple(schema)`
  // a cria (IF NOT EXISTS) antes de `applyAdditiveColumns`, então o
  // `ALTER TABLE food_entries ADD COLUMN measure_id ... REFERENCES food_measures`
  // encontra a tabela referenciada.
  await db.execute(
    "CREATE TABLE food_measures (id INTEGER PRIMARY KEY, food_id INTEGER, nome TEXT, qty_base REAL, ordem INTEGER)",
  );
  await db.execute(
    "CREATE TABLE food_entries (id INTEGER PRIMARY KEY, user_id INTEGER, data TEXT, meal_id INTEGER, food_id INTEGER, qty_g REAL, label TEXT, created_at TEXT)",
  );
  // Versões pré-migração de `exercises`, `workout_sessions` e `workout_sets`
  // (sem as colunas novas), espelhando um banco de produção real antes desta
  // migração aditiva — `columnExists` usa `PRAGMA table_info` e explode com
  // "no such table" se a tabela em si não existir, então essas três precisam
  // estar aqui mesmo não sendo o alvo direto do teste de `foods.base_unit`.
  await db.execute(
    "CREATE TABLE exercises (id INTEGER PRIMARY KEY, nome TEXT, grupo_muscular TEXT, created_at TEXT)",
  );
  await db.execute(
    "CREATE TABLE workout_sessions (id INTEGER PRIMARY KEY, user_id INTEGER, data TEXT, nome TEXT, created_at TEXT)",
  );
  await db.execute(
    "CREATE TABLE workout_sets (id INTEGER PRIMARY KEY, user_id INTEGER, session_id INTEGER, exercise_id INTEGER, ordem INTEGER, reps INTEGER, peso_kg REAL, created_at TEXT)",
  );
  // Linha pré-migração em `foods` (sem a coluna `base_unit` ainda).
  await db.execute(
    "INSERT INTO foods (id, nome, source, marca, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at) VALUES (1, 'Arroz', 'manual', NULL, 100, 130, 2.7, 28, 0.3, '2026-01-01')",
  );
  // Linhas pré-migração em `exercises`/`workout_sessions`/`workout_sets`
  // (sem `source`/`tipo`/`grupo_id`/`rir` ainda) — usadas abaixo para provar
  // que o `ALTER TABLE ... ADD COLUMN` real (não o `CREATE TABLE` do
  // schema.sql atualizado) aplica o DEFAULT correto a séries/exercícios já
  // registrados por usuários, sem reclassificá-los silenciosamente.
  await db.execute(
    "INSERT INTO exercises (id, nome, grupo_muscular, created_at) VALUES (1, 'Supino', 'Peito', '2026-01-01')",
  );
  await db.execute(
    "INSERT INTO workout_sessions (id, user_id, data, nome, created_at) VALUES (1, 1, '2026-01-01', NULL, '2026-01-01')",
  );
  await db.execute(
    "INSERT INTO workout_sets (id, user_id, session_id, exercise_id, ordem, reps, peso_kg, created_at) VALUES (1, 1, 1, 1, 1, 10, 40, '2026-01-01')",
  );

  await applyAdditiveColumns(db);
  await applyAdditiveColumns(db); // 2ª vez não pode quebrar
  const cols = await colunas(db, "users");
  expect(cols).toEqual(expect.arrayContaining(["aloy_enabled", "gemini_enabled", "gemini_api_key"]));
  const colsFoods = await colunas(db, "foods");
  expect(colsFoods).toEqual(expect.arrayContaining(["base_unit", "default_measure_id"]));
  const colsEntries = await colunas(db, "food_entries");
  expect(colsEntries).toEqual(expect.arrayContaining(["measure_id", "measure_count"]));

  // Backfill: a linha pré-existente deve ler `base_unit = 'g'` (DEFAULT aplicado
  // às linhas já existentes ao adicionar a coluna NOT NULL DEFAULT 'g').
  const backfill = await db.execute("SELECT base_unit FROM foods WHERE id = 1");
  expect(backfill.rows[0].base_unit).toBe("g");

  // FK na via de migração: `measure_id -> food_measures ON DELETE SET NULL`
  // precisa existir mesmo quando a coluna é criada por ALTER (banco já existente).
  const fks = await db.execute("PRAGMA foreign_key_list(food_entries)");
  const measureFk = fks.rows.find((r) => r.table === "food_measures");
  expect(measureFk).toBeDefined();
  expect(measureFk?.on_delete).toBe("SET NULL");

  // Backfill do ALTER real (caminho que roda contra o Turso de produção):
  // o exercício e a série pré-existentes não podem ser reclassificados. O
  // DEFAULT 'valida' de `workout_sets.tipo` é a única coisa que impede a
  // migração de mudar o significado de séries já registradas pelo usuário.
  const exRow = await db.execute("SELECT source, grupo_id FROM exercises WHERE id = 1");
  expect(exRow.rows[0].source).toBe("custom");
  expect(exRow.rows[0].grupo_id).toBeNull();

  const setRow = await db.execute("SELECT tipo, rir FROM workout_sets WHERE id = 1");
  expect(setRow.rows[0].tipo).toBe("valida");
  expect(setRow.rows[0].rir).toBeNull();
});

// Achado CRITICAL: no banco real, `exercises` já existe na forma antiga (sem as
// colunas novas). `executeMultiple(schema)` roda o schema.sql de ponta a ponta,
// na ordem real — inclui `CREATE TABLE IF NOT EXISTS exercises` (no-op, a tabela
// já existe) seguido dos `CREATE INDEX`. Se o schema.sql ainda criar um índice
// que referencia uma coluna aditiva (ex.: `idx_exercises_user ON exercises
// (user_id, nome)`) antes de `applyAdditiveColumns` rodar o `ALTER TABLE ADD
// COLUMN user_id`, o próprio `executeMultiple` explode com "no such column:
// user_id" e aborta no meio — `applyAdditiveColumns` nunca chega a rodar.
// Este teste usa o `schema.sql` real (não uma reconstrução manual), exatamente
// o caminho de produção (`applySchema`/`createTestDb`).
it("banco legado: exercises na forma antiga sobrevive ao pipeline completo (schema + colunas aditivas + índices aditivos)", async () => {
  const db = createClient({ url: ":memory:" });
  // Forma antiga de `exercises`, espelhando um banco de produção real antes
  // desta migração: só as 4 colunas originais.
  await db.execute(
    "CREATE TABLE exercises (id INTEGER PRIMARY KEY, nome TEXT, grupo_muscular TEXT, created_at TEXT)",
  );
  await db.execute(
    "INSERT INTO exercises (id, nome, grupo_muscular, created_at) VALUES (1, 'Supino', 'Peito', '2026-01-01')",
  );

  const schema = readFileSync(schemaPath, "utf-8");
  await db.executeMultiple(schema);
  await applyAdditiveColumns(db);
  await applyAdditiveColumns(db); // 2ª vez não pode quebrar

  const cols = await colunas(db, "exercises");
  expect(cols).toEqual(
    expect.arrayContaining(["user_id", "grupo_id", "source", "tipo", "equipamento"]),
  );

  const idx = await db.execute("PRAGMA index_list(exercises)");
  const idxNomes = idx.rows.map((r) => r.name as string);
  expect(idxNomes).toEqual(
    expect.arrayContaining(["idx_exercises_user", "idx_exercises_source_nome"]),
  );

  // Linha pré-existente sobrevive sem ser reclassificada.
  const row = await db.execute("SELECT nome, grupo_muscular, source FROM exercises WHERE id = 1");
  expect(row.rows[0].nome).toBe("Supino");
  expect(row.rows[0].grupo_muscular).toBe("Peito");
  expect(row.rows[0].source).toBe("custom");
});

it("adiciona nutrientes em foods e proveniência em food_measures", async () => {
  const db = await createTestDb();
  const foods = await db.execute("PRAGMA table_info(foods)");
  const nomesFoods = foods.rows.map((r) => r.name as string);
  expect(nomesFoods).toContain("fibra_g");
  expect(nomesFoods).toContain("sodio_mg");
  expect(nomesFoods).toContain("categoria");

  const medidas = await db.execute("PRAGMA table_info(food_measures)");
  const nomesMedidas = medidas.rows.map((r) => r.name as string);
  expect(nomesMedidas).toContain("source");
  expect(nomesMedidas).toContain("status");
  expect(nomesMedidas).toContain("pof_codigo");
});

it("medida nova nasce manual e confirmada (default das colunas aditivas)", async () => {
  const db = await createTestDb();
  await db.execute({
    sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
          VALUES ('Pão', 'custom', 100, 250, 8, 48, 3, ?)`,
    args: [new Date().toISOString()],
  });
  await db.execute(
    "INSERT INTO food_measures (food_id, nome, qty_base, ordem) VALUES (1, 'fatia', 25, 0)",
  );
  const rs = await db.execute("SELECT source, status FROM food_measures WHERE id=1");
  expect(rs.rows[0].source).toBe("manual");
  expect(rs.rows[0].status).toBe("confirmada");
});
