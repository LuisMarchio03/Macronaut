import { fileURLToPath } from "node:url";
import { applySchema } from "./lib/apply-schema.ts";

const url = process.env.AUTH_DB_URL;
if (!url) throw new Error("AUTH_DB_URL não definida");
const schemaPath = fileURLToPath(new URL("../src/db/auth-schema.sql", import.meta.url));

await applySchema(url, process.env.AUTH_DB_TOKEN, schemaPath);
console.log("Auth schema aplicado.");
