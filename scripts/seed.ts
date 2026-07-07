import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { importarTaco, type TacoItem } from "./seed-taco.ts";
import { seedDefaultMeals } from "../src/repositories/meals.ts";
import { seedActivityTypes } from "../src/repositories/activities.ts";

const url = process.env.VITE_TURSO_DATABASE_URL;
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;
if (!url) throw new Error("VITE_TURSO_DATABASE_URL não definida");

const caminho = process.env.TACO_JSON ?? "data/taco.json";
let itens: TacoItem[] = [];
try {
  itens = JSON.parse(readFileSync(fileURLToPath(new URL(`../${caminho}`, import.meta.url)), "utf-8"));
} catch {
  console.warn(`Sem ${caminho}; pulando importação da TACO.`);
}

const db = createClient({ url, authToken });
await seedDefaultMeals(db);
await seedActivityTypes(db);
const n = await importarTaco(db, itens);
console.log(`Refeições e atividades padrão garantidas. ${n} alimentos da TACO importados.`);
db.close();
