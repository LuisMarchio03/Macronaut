import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";

const ADDITIVE_COLUMNS: { table: string; column: string; ddl: string }[] = [
  { table: "users", column: "aloy_enabled",   ddl: "ALTER TABLE users ADD COLUMN aloy_enabled INTEGER NOT NULL DEFAULT 0" },
  { table: "users", column: "gemini_enabled", ddl: "ALTER TABLE users ADD COLUMN gemini_enabled INTEGER NOT NULL DEFAULT 0" },
  { table: "users", column: "gemini_api_key", ddl: "ALTER TABLE users ADD COLUMN gemini_api_key TEXT" },
  { table: "foods", column: "base_unit",          ddl: "ALTER TABLE foods ADD COLUMN base_unit TEXT NOT NULL DEFAULT 'g'" },
  { table: "foods", column: "default_measure_id", ddl: "ALTER TABLE foods ADD COLUMN default_measure_id INTEGER" },
  { table: "foods", column: "fibra_g",   ddl: "ALTER TABLE foods ADD COLUMN fibra_g REAL" },
  { table: "foods", column: "sodio_mg",  ddl: "ALTER TABLE foods ADD COLUMN sodio_mg REAL" },
  { table: "foods", column: "categoria", ddl: "ALTER TABLE foods ADD COLUMN categoria TEXT" },
  { table: "food_measures", column: "source",     ddl: "ALTER TABLE food_measures ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'" },
  { table: "food_measures", column: "status",     ddl: "ALTER TABLE food_measures ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmada'" },
  { table: "food_measures", column: "pof_codigo", ddl: "ALTER TABLE food_measures ADD COLUMN pof_codigo TEXT" },
  { table: "food_measures", column: "pof_descricao", ddl: "ALTER TABLE food_measures ADD COLUMN pof_descricao TEXT" },
  { table: "food_entries", column: "measure_id",    ddl: "ALTER TABLE food_entries ADD COLUMN measure_id INTEGER REFERENCES food_measures (id) ON DELETE SET NULL" },
  { table: "food_entries", column: "measure_count", ddl: "ALTER TABLE food_entries ADD COLUMN measure_count REAL" },
  { table: "exercises", column: "user_id",     ddl: "ALTER TABLE exercises ADD COLUMN user_id INTEGER" },
  { table: "exercises", column: "grupo_id",    ddl: "ALTER TABLE exercises ADD COLUMN grupo_id INTEGER REFERENCES muscle_groups (id)" },
  { table: "exercises", column: "source",      ddl: "ALTER TABLE exercises ADD COLUMN source TEXT NOT NULL DEFAULT 'custom'" },
  { table: "exercises", column: "tipo",        ddl: "ALTER TABLE exercises ADD COLUMN tipo TEXT" },
  { table: "exercises", column: "equipamento", ddl: "ALTER TABLE exercises ADD COLUMN equipamento TEXT" },
  { table: "workout_sets", column: "tipo", ddl: "ALTER TABLE workout_sets ADD COLUMN tipo TEXT NOT NULL DEFAULT 'valida'" },
  { table: "workout_sets", column: "rir",  ddl: "ALTER TABLE workout_sets ADD COLUMN rir INTEGER" },
  { table: "workout_sets", column: "nota", ddl: "ALTER TABLE workout_sets ADD COLUMN nota TEXT" },
  { table: "workout_sessions", column: "nota", ddl: "ALTER TABLE workout_sessions ADD COLUMN nota TEXT" },
];

/**
 * Índices que referenciam colunas aditivas (ver ADDITIVE_COLUMNS acima). Não
 * podem viver em schema.sql: num banco legado a tabela já existe (o `CREATE
 * TABLE IF NOT EXISTS` é no-op) e um `CREATE INDEX` sobre uma coluna que ainda
 * não existe explode `executeMultiple` no meio, antes de `applyAdditiveColumns`
 * rodar os `ALTER TABLE ADD COLUMN`. Por isso são aplicados aqui, depois das
 * colunas. `CREATE INDEX IF NOT EXISTS` já é idempotente por si só — não precisa
 * do mesmo gate de "existe?" que as colunas (ALTER ... ADD COLUMN não é IF NOT
 * EXISTS e erraria numa 2ª chamada).
 */
const ADDITIVE_INDEXES: { ddl: string }[] = [
  { ddl: "CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises (user_id, nome)" },
  { ddl: "CREATE INDEX IF NOT EXISTS idx_exercises_source_nome ON exercises (source, nome)" },
  { ddl: "CREATE INDEX IF NOT EXISTS idx_food_measures_status ON food_measures (food_id, status)" },
];

async function columnExists(db: Client, table: string, column: string): Promise<boolean> {
  const rs = await db.execute(`PRAGMA table_info(${table})`); // table é literal interno, sem input externo
  return rs.rows.some((r) => (r.name as string) === column);
}

export async function applyAdditiveColumns(db: Client): Promise<void> {
  for (const m of ADDITIVE_COLUMNS) {
    if (!(await columnExists(db, m.table, m.column))) await db.execute(m.ddl);
  }
  for (const idx of ADDITIVE_INDEXES) {
    await db.execute(idx.ddl);
  }
}

export async function applySchema(
  url: string,
  authToken: string | undefined,
  schemaPath: string,
): Promise<void> {
  const schema = readFileSync(schemaPath, "utf-8");
  const db = createClient({ url, authToken });
  await db.executeMultiple(schema);
  await applyAdditiveColumns(db);
  db.close();
}
