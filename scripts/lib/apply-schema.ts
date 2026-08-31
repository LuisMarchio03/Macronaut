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
  // O nome sem acento e em minúsculas, para a busca. `LIKE ... COLLATE NOCASE`
  // do SQLite só é insensível a caixa em ASCII — não casa "acucar" com
  // "Açúcar", e a TACO é toda acentuada. Coluna e não expressão porque o
  // libSQL não tem `unaccent`, e normalizar em JS é a mesma função que a
  // busca do exercício já usa.
  { table: "foods", column: "nome_norm", ddl: "ALTER TABLE foods ADD COLUMN nome_norm TEXT" },
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
  // Água creditada a um período do plano. Inferir o período pelo horário do
  // `created_at` daria a resposta errada para quem registra à noite a água que
  // bebeu de manhã — o registro é do dia, não do instante.
  { table: "water_log", column: "block_id", ddl: "ALTER TABLE water_log ADD COLUMN block_id INTEGER" },
  // Qual percentual do Training Max a série cumpria, e se era a AMRAP. O que
  // já foi registrado antes do programa continua válido com as duas nulas.
  { table: "workout_sets", column: "prescribed_pct", ddl: "ALTER TABLE workout_sets ADD COLUMN prescribed_pct REAL" },
  { table: "workout_sets", column: "amrap", ddl: "ALTER TABLE workout_sets ADD COLUMN amrap INTEGER" },
  // Quando o usuário disse que o treino acabou. NULL = em andamento. Explícito
  // e não derivado: uma sessão pode terminar com séries por fazer, e derivar
  // "acabou" de "não sobrou nada pendente" nunca deixaria essa sessão fechar.
  { table: "workout_sessions", column: "concluida_em", ddl: "ALTER TABLE workout_sessions ADD COLUMN concluida_em TEXT" },
  // Cardio virou exercício do catálogo, para a sessão continuar sendo UMA lista
  // ordenada. O MET mora aqui porque é do exercício, não da rotina.
  { table: "exercises", column: "met", ddl: "ALTER TABLE exercises ADD COLUMN met REAL" },
  // A ficha do exercício: como executar, que músculos ele também pega, e por
  // que outros nomes você o chama. Nulas em toda linha pré-existente, e o app
  // funciona com as três nulas — é enriquecimento, não requisito.
  { table: "exercises", column: "instrucoes",           ddl: "ALTER TABLE exercises ADD COLUMN instrucoes TEXT" },
  { table: "exercises", column: "musculos_secundarios", ddl: "ALTER TABLE exercises ADD COLUMN musculos_secundarios TEXT" },
  { table: "exercises", column: "aliases",              ddl: "ALTER TABLE exercises ADD COLUMN aliases TEXT" },
  { table: "routine_exercises", column: "duracao_min", ddl: "ALTER TABLE routine_exercises ADD COLUMN duracao_min REAL" },
  { table: "session_plan_sets", column: "duracao_min", ddl: "ALTER TABLE session_plan_sets ADD COLUMN duracao_min REAL" },
  // O elo do cardio com o realizado. Cardio grava em activity_sessions, não em
  // workout_sets: lá vive levantamento de peso, e contaminar aquela tabela
  // quebraria volume, 1RM e progressão de uma vez.
  { table: "session_plan_sets", column: "activity_id", ddl: "ALTER TABLE session_plan_sets ADD COLUMN activity_id INTEGER" },
  // Que fração do peso do corpo o movimento levanta: flexão ≈ 0,64, barra
  // fixa ≈ 1,00. É o que converte "40 flexões" em volume comparável ao da
  // musculação. NULL onde a pergunta não faz sentido (barra, máquina, cardio).
  { table: "exercises", column: "fracao_corporal", ddl: "ALTER TABLE exercises ADD COLUMN fracao_corporal REAL" },
  // 'reps' | 'segundos'. Prancha se mede em segundos, e a folha de registro
  // precisa saber disso ANTES de o usuário digitar. NULL = reps.
  { table: "exercises", column: "medida", ddl: "ALTER TABLE exercises ADD COLUMN medida TEXT" },
  // De qual bloco do plano este lançamento veio. É o que permite desmarcar
  // "Comi" e apagar exatamente o que aquele bloco lançou naquele dia, sem
  // encostar no que você digitou à mão. NULL = registro do diário livre.
  { table: "food_entries", column: "plan_block_id", ddl: "ALTER TABLE food_entries ADD COLUMN plan_block_id INTEGER" },
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
  { ddl: "CREATE INDEX IF NOT EXISTS idx_foods_nome_norm ON foods (nome_norm)" },
  { ddl: "CREATE INDEX IF NOT EXISTS idx_entries_plan_block ON food_entries (user_id, data, plan_block_id)" },
];

/**
 * A tabela existe?
 *
 * `applyAdditiveColumns` roda depois do schema, quando toda tabela já foi
 * criada — mas ela também é chamada isolada (em teste, e num banco legado que
 * nunca teve as tabelas novas). Sem esta guarda, um `ALTER TABLE` numa tabela
 * inexistente aborta a aplicação inteira no meio.
 */
async function tableExists(db: Client, table: string): Promise<boolean> {
  const rs = await db.execute({
    sql: "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
    args: [table],
  });
  return rs.rows.length > 0;
}

async function columnExists(db: Client, table: string, column: string): Promise<boolean> {
  const rs = await db.execute(`PRAGMA table_info(${table})`); // table é literal interno, sem input externo
  return rs.rows.some((r) => (r.name as string) === column);
}

export async function applyAdditiveColumns(db: Client): Promise<void> {
  for (const m of ADDITIVE_COLUMNS) {
    if (!(await tableExists(db, m.table))) continue;
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
