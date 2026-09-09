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
  // Quando o treino COMEÇOU, que não é quando a linha foi criada: entre as
  // duas coisas mora o rascunho — a sessão que existe, tem nome e plano, e
  // ainda não está acontecendo. NULL = rascunho. Ver BACKFILLS abaixo: sem o
  // acompanhamento, esta coluna transformaria todo o histórico em rascunho.
  { table: "workout_sessions", column: "iniciado_em", ddl: "ALTER TABLE workout_sessions ADD COLUMN iniciado_em TEXT" },
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
  // De onde a atividade veio, e qual é o id dela LÁ. É o par que impede o
  // treino que você registrou na mão e o que o relógio mandou de contarem
  // duas vezes no balanço energético. NULL = registrada dentro do app.
  { table: "activity_sessions", column: "origem",    ddl: "ALTER TABLE activity_sessions ADD COLUMN origem TEXT" },
  { table: "activity_sessions", column: "origem_id", ddl: "ALTER TABLE activity_sessions ADD COLUMN origem_id TEXT" },
  { table: "weigh_ins",         column: "origem",    ddl: "ALTER TABLE weigh_ins ADD COLUMN origem TEXT" },
  // Água tem o mesmo par que a atividade, e pelo mesmo motivo: o
  // `HydrationRecord` do Health Connect tem `metadata.id`, então o gole que o
  // relógio mandou é reconhecível na sincronização seguinte. Sem isso, cada
  // releitura da janela somaria os mesmos 200 ml de novo.
  { table: "water_log", column: "origem",    ddl: "ALTER TABLE water_log ADD COLUMN origem TEXT" },
  { table: "water_log", column: "origem_id", ddl: "ALTER TABLE water_log ADD COLUMN origem_id TEXT" },
];

/**
 * Índices que referenciam colunas aditivas (ver ADDITIVE_COLUMNS acima). Não
 * podem viver em schema.sql: num banco legado a tabela já existe (o `CREATE
 * TABLE IF NOT EXISTS` é no-op) e um `CREATE INDEX` sobre uma coluna que ainda
 * não existe explode `executeMultiple` no meio, antes de `applyAdditiveColumns`
 * rodar os `ALTER TABLE ADD COLUMN`. Por isso são aplicados aqui, depois das
 * colunas.
 *
 * O `IF NOT EXISTS` cobre rodar de novo, e só isso: num banco que ainda não
 * tem a TABELA, ele erra igual. Por isso cada índice diz de qual tabela é, e
 * é pulado quando ela falta — a mesma guarda que as colunas já tinham.
 */
const ADDITIVE_INDEXES: { table: string; ddl: string }[] = [
  { table: "exercises", ddl: "CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises (user_id, nome)" },
  { table: "exercises", ddl: "CREATE INDEX IF NOT EXISTS idx_exercises_source_nome ON exercises (source, nome)" },
  { table: "food_measures", ddl: "CREATE INDEX IF NOT EXISTS idx_food_measures_status ON food_measures (food_id, status)" },
  { table: "foods", ddl: "CREATE INDEX IF NOT EXISTS idx_foods_nome_norm ON foods (nome_norm)" },
  { table: "food_entries", ddl: "CREATE INDEX IF NOT EXISTS idx_entries_plan_block ON food_entries (user_id, data, plan_block_id)" },
  // O índice que a deduplicação da sincronização consulta a cada item.
  { table: "activity_sessions", ddl: "CREATE UNIQUE INDEX IF NOT EXISTS idx_asessions_origem ON activity_sessions (user_id, origem, origem_id) WHERE origem IS NOT NULL" },
  { table: "water_log", ddl: "CREATE UNIQUE INDEX IF NOT EXISTS idx_water_origem ON water_log (user_id, origem, origem_id) WHERE origem IS NOT NULL" },
  // No máximo uma dispensa por linha por dia. A exclusão mútua entre dispensa
  // e troca é do repositório: um CHECK não enxerga outras linhas.
  { table: "plan_item_swaps", ddl: "CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_item_swaps_dispensa ON plan_item_swaps (user_id, data, item_id) WHERE dispensado = 1" },
];

/**
 * Mudanças de tabela que `ALTER TABLE` não faz.
 *
 * SQLite não remove `UNIQUE` nem altera `CHECK`: a tabela tem que ser recriada
 * e os dados copiados. É o passo mais perigoso de uma migração — ele APAGA uma
 * tabela —, então cada entrada diz como RECONHECER o formato antigo lendo o
 * DDL que o próprio SQLite guardou em `sqlite_master`. Reconhecido,
 * reconstrói; não reconhecido, não faz nada. É isso que torna o passo
 * idempotente e seguro de rodar a cada `db:setup`.
 */
const REBUILDS: { table: string; obsoleto: RegExp; passos: string[] }[] = [
  {
    // `plan_item_swaps` nasceu com uma troca por linha do plano por dia, e
    // trocar de novo corrigia a anterior. Uma linha passa a caber vários
    // alimentos, e a dispensa ("não comi esta linha") entra como terceira
    // resposta possível.
    table: "plan_item_swaps",
    obsoleto: /UNIQUE\s*\(\s*user_id\s*,\s*data\s*,\s*item_id\s*\)/i,
    passos: [
      `CREATE TABLE plan_item_swaps_nova (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL, data TEXT NOT NULL,
         block_id INTEGER NOT NULL, item_id INTEGER NOT NULL,
         swap_id INTEGER, food_id INTEGER, texto TEXT,
         qty_g REAL, measure_id INTEGER, medidas REAL, kcal REAL,
         dispensado INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL,
         CHECK (
           (dispensado = 1 AND swap_id IS NULL AND food_id IS NULL AND texto IS NULL)
           OR
           (dispensado = 0
            AND (swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
         ),
         FOREIGN KEY (block_id)   REFERENCES plan_blocks (id)   ON DELETE CASCADE,
         FOREIGN KEY (item_id)    REFERENCES plan_items (id)    ON DELETE CASCADE,
         FOREIGN KEY (swap_id)    REFERENCES plan_swaps (id)    ON DELETE SET NULL,
         FOREIGN KEY (food_id)    REFERENCES foods (id)         ON DELETE SET NULL,
         FOREIGN KEY (measure_id) REFERENCES food_measures (id) ON DELETE SET NULL
       )`,
      // Toda troca já gravada continua sendo uma troca: dispensado = 0.
      `INSERT INTO plan_item_swaps_nova
         (id, user_id, data, block_id, item_id, swap_id, food_id, texto,
          qty_g, measure_id, medidas, kcal, dispensado, created_at)
       SELECT id, user_id, data, block_id, item_id, swap_id, food_id, texto,
              qty_g, measure_id, medidas, kcal, 0, created_at
         FROM plan_item_swaps`,
      `DROP TABLE plan_item_swaps`,
      `ALTER TABLE plan_item_swaps_nova RENAME TO plan_item_swaps`,
      `CREATE INDEX IF NOT EXISTS idx_plan_item_swaps_dia
         ON plan_item_swaps (user_id, data)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_item_swaps_dispensa
         ON plan_item_swaps (user_id, data, item_id) WHERE dispensado = 1`,
    ],
  },
  {
    // A troca era sempre de uma LINHA (`item_id NOT NULL`), e a lista nova de
    // uma refeição inteira não cabia: três alimentos no lugar de cinco linhas
    // exigia pendurar os três numa linha e dispensar as outras quatro, o que
    // afirma que a pizza substituiu o arroz quando ela substituiu o almoço.
    // `item_id NULL` passa a dizer "esta troca substitui o bloco".
    //
    // Vem DEPOIS da entrada acima de propósito: `aplicarReconstrucoes` relê o
    // `sqlite_master` a cada entrada, então num banco antigo a primeira tira o
    // `UNIQUE` e produz exatamente o `item_id INTEGER NOT NULL` que esta
    // reconhece — as duas numa passada só.
    table: "plan_item_swaps",
    obsoleto: /item_id\s+INTEGER\s+NOT\s+NULL/i,
    passos: [
      `CREATE TABLE plan_item_swaps_nova (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL, data TEXT NOT NULL,
         block_id INTEGER NOT NULL, item_id INTEGER,
         swap_id INTEGER, food_id INTEGER, texto TEXT,
         qty_g REAL, measure_id INTEGER, medidas REAL, kcal REAL,
         dispensado INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL,
         CHECK (
           (dispensado = 1 AND item_id IS NOT NULL
            AND swap_id IS NULL AND food_id IS NULL AND texto IS NULL)
           OR
           (dispensado = 0
            AND (swap_id IS NOT NULL) + (food_id IS NOT NULL) + (texto IS NOT NULL) = 1)
         ),
         FOREIGN KEY (block_id)   REFERENCES plan_blocks (id)   ON DELETE CASCADE,
         FOREIGN KEY (item_id)    REFERENCES plan_items (id)    ON DELETE CASCADE,
         FOREIGN KEY (swap_id)    REFERENCES plan_swaps (id)    ON DELETE SET NULL,
         FOREIGN KEY (food_id)    REFERENCES foods (id)         ON DELETE SET NULL,
         FOREIGN KEY (measure_id) REFERENCES food_measures (id) ON DELETE SET NULL
       )`,
      // Toda linha já gravada tinha `item_id`, e continua tendo: nenhuma troca
      // muda de sentido ao atravessar.
      `INSERT INTO plan_item_swaps_nova
         (id, user_id, data, block_id, item_id, swap_id, food_id, texto,
          qty_g, measure_id, medidas, kcal, dispensado, created_at)
       SELECT id, user_id, data, block_id, item_id, swap_id, food_id, texto,
              qty_g, measure_id, medidas, kcal, dispensado, created_at
         FROM plan_item_swaps`,
      `DROP TABLE plan_item_swaps`,
      `ALTER TABLE plan_item_swaps_nova RENAME TO plan_item_swaps`,
      `CREATE INDEX IF NOT EXISTS idx_plan_item_swaps_dia
         ON plan_item_swaps (user_id, data)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_item_swaps_dispensa
         ON plan_item_swaps (user_id, data, item_id) WHERE dispensado = 1`,
    ],
  },
];

/**
 * O que uma coluna aditiva precisa que seja verdade nas linhas que já existem.
 *
 * `ALTER TABLE ADD COLUMN` deixa NULL em toda linha antiga, e para algumas
 * colunas NULL é uma afirmação errada, não a ausência de uma. `iniciado_em` é
 * o caso: no modelo anterior criar uma sessão ERA iniciá-la, então deixá-la
 * nula diria que nenhum treino já feito jamais começou — e como
 * `estadoDaSessao` lê isso como "rascunho", o histórico inteiro sumiria da aba
 * Progresso, da consistência e da análise no primeiro deploy.
 *
 * Todo comando aqui é idempotente pelo próprio `WHERE`, porque
 * `applyAdditiveColumns` roda a cada `db:setup`.
 */
const BACKFILLS: { table: string; sql: string }[] = [
  {
    table: "workout_sessions",
    sql: "UPDATE workout_sessions SET iniciado_em = created_at WHERE iniciado_em IS NULL",
  },
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

/** O DDL com que a tabela foi criada, como o SQLite o guardou. */
async function ddlDaTabela(db: Client, table: string): Promise<string | null> {
  const rs = await db.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
    args: [table],
  });
  return rs.rows.length ? ((rs.rows[0].sql as string | null) ?? null) : null;
}

async function aplicarReconstrucoes(db: Client): Promise<void> {
  for (const r of REBUILDS) {
    const ddl = await ddlDaTabela(db, r.table);
    if (ddl === null || !r.obsoleto.test(ddl)) continue;
    // `migrate`, e não `batch`: é o modo do libSQL para DDL transacional — ele
    // suspende a checagem de chave estrangeira durante a troca. Com as FKs
    // ativas, o DROP no meio do lote falha ou deixa a tabela pela metade.
    await db.migrate(r.passos);
  }
}

async function columnExists(db: Client, table: string, column: string): Promise<boolean> {
  const rs = await db.execute(`PRAGMA table_info(${table})`); // table é literal interno, sem input externo
  return rs.rows.some((r) => (r.name as string) === column);
}

export async function applyAdditiveColumns(db: Client): Promise<void> {
  // Antes das colunas: uma tabela reconstruída já nasce no formato final, e as
  // colunas aditivas seguintes precisam vê-la assim.
  await aplicarReconstrucoes(db);
  for (const m of ADDITIVE_COLUMNS) {
    if (!(await tableExists(db, m.table))) continue;
    if (!(await columnExists(db, m.table, m.column))) await db.execute(m.ddl);
  }
  for (const idx of ADDITIVE_INDEXES) {
    if (!(await tableExists(db, idx.table))) continue;
    await db.execute(idx.ddl);
  }
  for (const b of BACKFILLS) {
    if (!(await tableExists(db, b.table))) continue;
    await db.execute(b.sql);
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
