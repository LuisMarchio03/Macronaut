import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";

const ADDITIVE_COLUMNS: { table: string; column: string; ddl: string }[] = [
  { table: "users", column: "aloy_enabled",   ddl: "ALTER TABLE users ADD COLUMN aloy_enabled INTEGER NOT NULL DEFAULT 0" },
  { table: "users", column: "gemini_enabled", ddl: "ALTER TABLE users ADD COLUMN gemini_enabled INTEGER NOT NULL DEFAULT 0" },
  { table: "users", column: "gemini_api_key", ddl: "ALTER TABLE users ADD COLUMN gemini_api_key TEXT" },
];

async function columnExists(db: Client, table: string, column: string): Promise<boolean> {
  const rs = await db.execute(`PRAGMA table_info(${table})`); // table é literal interno, sem input externo
  return rs.rows.some((r) => (r.name as string) === column);
}

export async function applyAdditiveColumns(db: Client): Promise<void> {
  for (const m of ADDITIVE_COLUMNS) {
    if (!(await columnExists(db, m.table, m.column))) await db.execute(m.ddl);
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
