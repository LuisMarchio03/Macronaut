import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const url = process.env.VITE_TURSO_DATABASE_URL;
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;
if (!url) throw new Error("VITE_TURSO_DATABASE_URL não definida");

const schema = readFileSync(
  fileURLToPath(new URL("../src/db/schema.sql", import.meta.url)),
  "utf-8",
);

const db = createClient({ url, authToken });
await db.executeMultiple(schema);
console.log("Schema aplicado ao Turso.");
db.close();
