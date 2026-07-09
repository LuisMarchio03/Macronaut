import { it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { applyAdditiveColumns } from "./apply-schema";

async function colunas(db: ReturnType<typeof createClient>, tabela: string): Promise<string[]> {
  const rs = await db.execute(`PRAGMA table_info(${tabela})`);
  return rs.rows.map((r) => r.name as string);
}

it("adiciona as colunas de IA em users e é idempotente", async () => {
  const db = createClient({ url: ":memory:" });
  await db.execute(
    "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, password_hash TEXT, created_at TEXT)",
  );
  await applyAdditiveColumns(db);
  await applyAdditiveColumns(db); // 2ª vez não pode quebrar
  const cols = await colunas(db, "users");
  expect(cols).toEqual(expect.arrayContaining(["aloy_enabled", "gemini_enabled", "gemini_api_key"]));
});
