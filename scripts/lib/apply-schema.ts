import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

export async function applySchema(
  url: string,
  authToken: string | undefined,
  schemaPath: string,
): Promise<void> {
  const schema = readFileSync(schemaPath, "utf-8");
  const db = createClient({ url, authToken });
  await db.executeMultiple(schema);
  db.close();
}
