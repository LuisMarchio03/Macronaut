import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyAdditiveColumns } from "../../scripts/lib/apply-schema";

// Nota: `new URL("../../src/db/schema.sql", import.meta.url)` é interceptado
// estaticamente pelo plugin de análise de import do Vite (tratado como
// referência de asset), que o reescreve para uma URL http do dev server em
// vez de manter o esquema file:. Resolvemos o caminho em duas etapas para
// evitar esse padrão e obter o caminho de arquivo real.
const here = fileURLToPath(import.meta.url);

export async function createTestDb(schemaFile = "schema.sql"): Promise<Client> {
  const schemaPath = resolve(dirname(here), `../../src/db/${schemaFile}`);
  const schema = readFileSync(schemaPath, "utf-8");
  const db = createClient({ url: ":memory:" });
  // A conexão :memory: é persistente, então este PRAGMA vale para todos os
  // testes de repository construídos sobre o harness, tornando reais as FKs
  // declaradas no schema (ex.: food_entries.meal_id ... ON DELETE SET NULL).
  await db.execute("PRAGMA foreign_keys = ON");
  await db.executeMultiple(schema);
  await applyAdditiveColumns(db);
  return db;
}
